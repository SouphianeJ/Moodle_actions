/**
 * Student Submissions Service
 * 
 * Orchestrates the Moodle WS calls to fetch assignments and student submissions
 * with file information for preview.
 */

import {
  getCourseContents,
  getSubmissionStatusFull,
  getUsersByIds,
  getMoodleToken,
  type SubmissionFile,
  type UserInfo,
} from './client';

// Concurrency limit for parallel requests
const CONCURRENCY_LIMIT = 5;

export interface AssignmentInfo {
  cmid: number; // course module id
  assignid: number; // assignment instance id
  name: string;
  visible: boolean;
}

export interface StudentFileInfo {
  filename: string;
  filepath: string;
  filesize: number;
  fileurl: string;
  mimetype: string;
  assignmentName: string;
  assignid: number;
  cmid: number;
}

export interface StudentSubmissionData {
  userId: number;
  firstName: string;
  lastName: string;
  email?: string;
  files: StudentFileInfo[];
  status: 'submitted' | 'draft' | 'nosubmission';
}

export interface AssignmentsResult {
  success: boolean;
  data?: AssignmentInfo[];
  error?: string;
}

export interface StudentFilesResult {
  success: boolean;
  data?: StudentSubmissionData;
  error?: string;
}

/**
 * Processes an array in chunks with a concurrency limit
 */
async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrencyLimit: number
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += concurrencyLimit) {
    const chunk = items.slice(i, i + concurrencyLimit);
    const chunkResults = await Promise.all(chunk.map(processor));
    results.push(...chunkResults);
  }
  
  return results;
}

/**
 * List all assignments in a course
 */
export async function listCourseAssignments(courseId: number): Promise<AssignmentsResult> {
  console.log(`[StudentSubmissions] Listing assignments for course ${courseId}`);
  
  const contentsResponse = await getCourseContents(courseId);
  
  if (contentsResponse.error) {
    console.error(`[StudentSubmissions] Error getting course contents: ${contentsResponse.error.message}`);
    return {
      success: false,
      error: `Impossible de récupérer le contenu du cours: ${contentsResponse.error.message}`,
    };
  }
  
  const sections = contentsResponse.data || [];
  const assignments: AssignmentInfo[] = [];
  
  for (const section of sections) {
    for (const mod of section.modules || []) {
      if (mod.modname === 'assign') {
        assignments.push({
          cmid: mod.id,
          assignid: mod.instance,
          name: mod.name,
          visible: mod.visible !== 0,
        });
      }
    }
  }
  
  console.log(`[StudentSubmissions] Found ${assignments.length} assignments in course ${courseId}`);
  
  return {
    success: true,
    data: assignments,
  };
}

/**
 * Extract files from submission plugins
 */
function extractFilesFromSubmission(
  plugins: Array<{ type: string; name: string; fileareas?: Array<{ area: string; files: SubmissionFile[] }> }> | undefined,
  assignmentName: string,
  assignid: number,
  cmid: number
): StudentFileInfo[] {
  if (!plugins) return [];
  
  const files: StudentFileInfo[] = [];
  
  for (const plugin of plugins) {
    if (plugin.type === 'file' && plugin.fileareas) {
      for (const filearea of plugin.fileareas) {
        if (filearea.area === 'submission_files') {
          for (const file of filearea.files || []) {
            files.push({
              filename: file.filename,
              filepath: file.filepath,
              filesize: file.filesize,
              fileurl: file.fileurl,
              mimetype: file.mimetype,
              assignmentName,
              assignid,
              cmid,
            });
          }
        }
      }
    }
  }
  
  return files;
}

/**
 * Get files for a student across multiple assignments
 */
export async function getStudentFiles(
  userId: number,
  assignments: AssignmentInfo[]
): Promise<StudentFilesResult> {
  console.log(`[StudentSubmissions] Getting files for user ${userId} across ${assignments.length} assignments`);
  
  // Get user info
  const userResponse = await getUsersByIds([userId]);
  let userInfo: UserInfo | undefined;
  
  if (userResponse.data && userResponse.data.length > 0) {
    userInfo = userResponse.data[0];
  }
  
  const allFiles: StudentFileInfo[] = [];
  let overallStatus: 'submitted' | 'draft' | 'nosubmission' = 'nosubmission';
  
  // Process assignments with concurrency limit
  const results = await processWithConcurrency(
    assignments,
    async (assignment) => {
      try {
        const statusResponse = await getSubmissionStatusFull(assignment.assignid, userId);
        
        if (statusResponse.error) {
          console.warn(`[StudentSubmissions] Error getting submission for assignment ${assignment.assignid}: ${statusResponse.error.message}`);
          return { files: [], status: 'nosubmission' as const };
        }
        
        const submission = statusResponse.data?.lastattempt?.submission;
        
        if (!submission) {
          return { files: [], status: 'nosubmission' as const };
        }
        
        const submissionStatus = submission.status === 'submitted' ? 'submitted' as const : 
                                 submission.status === 'draft' ? 'draft' as const : 'nosubmission' as const;
        
        const files = extractFilesFromSubmission(
          submission.plugins,
          assignment.name,
          assignment.assignid,
          assignment.cmid
        );
        
        return { files, status: submissionStatus };
      } catch (err) {
        console.error(`[StudentSubmissions] Exception for assignment ${assignment.assignid}:`, err);
        return { files: [], status: 'nosubmission' as const };
      }
    },
    CONCURRENCY_LIMIT
  );
  
  // Aggregate results
  for (const result of results) {
    allFiles.push(...result.files);
    if (result.status === 'submitted') {
      overallStatus = 'submitted';
    } else if (result.status === 'draft' && overallStatus !== 'submitted') {
      overallStatus = 'draft';
    }
  }
  
  console.log(`[StudentSubmissions] Found ${allFiles.length} files for user ${userId}`);
  
  return {
    success: true,
    data: {
      userId,
      firstName: userInfo?.firstname || '',
      lastName: userInfo?.lastname || '',
      email: userInfo?.email,
      files: allFiles,
      status: overallStatus,
    },
  };
}

/**
 * Append token to file URL for direct access
 */
export function getFileUrlWithToken(fileurl: string): string {
  const token = getMoodleToken();
  if (!token) return fileurl;
  
  const url = new URL(fileurl);
  url.searchParams.set('token', token);
  return url.toString();
}
