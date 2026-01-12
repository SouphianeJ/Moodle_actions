/**
 * Assignment Feedback Exporter Service
 * 
 * Orchestrates the Moodle WS calls to collect assignment feedback data
 * and formats it for CSV export.
 */

import {
  getCourseModule,
  getAssignmentSubmissions,
  getSubmissionStatus,
  getUsersByIds,
  type UserInfo,
  type FeedbackPlugin,
} from './client';
import { htmlToText } from '../text/htmlToText';

// Concurrency limit for parallel requests
const CONCURRENCY_LIMIT = 5;
const USER_BATCH_SIZE = 50;

export interface StudentFeedback {
  userId: number;
  lastName: string;
  firstName: string;
  grade: string;
  feedback: string;
}

export interface ExportResult {
  success: boolean;
  data?: StudentFeedback[];
  error?: string;
  stats?: {
    totalStudents: number;
    gradedCount: number;
    ungradedCount: number;
    errorCount: number;
    durationMs: number;
  };
}

/**
 * Extracts the feedback comment text from the feedback plugins
 */
function extractFeedbackComment(plugins: FeedbackPlugin[] | undefined): string {
  if (!plugins) {
    return '';
  }

  const commentsPlugin = plugins.find(p => p.type === 'comments');
  if (!commentsPlugin || !commentsPlugin.editorfields) {
    return '';
  }

  const commentsField = commentsPlugin.editorfields.find(f => f.name === 'comments');
  if (!commentsField || !commentsField.text) {
    return '';
  }

  return htmlToText(commentsField.text);
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
 * Fetches user information in batches
 */
async function fetchUsersInBatches(userIds: number[]): Promise<Map<number, UserInfo>> {
  const userMap = new Map<number, UserInfo>();
  
  for (let i = 0; i < userIds.length; i += USER_BATCH_SIZE) {
    const batch = userIds.slice(i, i + USER_BATCH_SIZE);
    const response = await getUsersByIds(batch);
    
    if (response.data) {
      for (const user of response.data) {
        userMap.set(user.id, user);
      }
    }
  }
  
  return userMap;
}

/**
 * Main export function: Orchestrates the full feedback export workflow
 * 
 * @param cmid - The course module ID from Moodle URL
 * @returns Export result with student feedback data
 */
export async function exportAssignmentFeedback(cmid: number): Promise<ExportResult> {
  const startTime = Date.now();
  
  // Step A: Resolve the assignment instance from cmid
  console.log(`[AssignmentFeedback] Starting export for cmid=${cmid}`);
  
  const moduleResponse = await getCourseModule(cmid);
  
  if (moduleResponse.error) {
    console.error(`[AssignmentFeedback] Error getting course module: ${moduleResponse.error.message}`);
    return {
      success: false,
      error: `Impossible de récupérer le module de cours: ${moduleResponse.error.message}`,
    };
  }
  
  const cm = moduleResponse.data?.cm;
  
  if (!cm || !cm.instance) {
    return {
      success: false,
      error: "L'identifiant fourni ne correspond pas à un module valide.",
    };
  }
  
  if (cm.modname !== 'assign') {
    return {
      success: false,
      error: `Cet ID ne correspond pas à un devoir (type détecté: ${cm.modname}).`,
    };
  }
  
  const assignmentId = cm.instance;
  console.log(`[AssignmentFeedback] Resolved to assignment instance=${assignmentId}`);
  
  // Step B: Get submissions to collect user IDs
  const submissionsResponse = await getAssignmentSubmissions(assignmentId);
  
  if (submissionsResponse.error) {
    console.error(`[AssignmentFeedback] Error getting submissions: ${submissionsResponse.error.message}`);
    return {
      success: false,
      error: `Impossible de récupérer les soumissions: ${submissionsResponse.error.message}`,
    };
  }
  
  const submissions = submissionsResponse.data?.assignments?.[0]?.submissions || [];
  
  if (submissions.length === 0) {
    console.log(`[AssignmentFeedback] No submissions found for assignment ${assignmentId}`);
    return {
      success: true,
      data: [],
      stats: {
        totalStudents: 0,
        gradedCount: 0,
        ungradedCount: 0,
        errorCount: 0,
        durationMs: Date.now() - startTime,
      },
    };
  }
  
  const userIds = [...new Set(submissions.map(s => s.userid))];
  console.log(`[AssignmentFeedback] Found ${userIds.length} unique students`);
  
  // Step D: Fetch user information (before step C for efficiency)
  const userMap = await fetchUsersInBatches(userIds);
  console.log(`[AssignmentFeedback] Fetched ${userMap.size} user profiles`);
  
  // Step C: Get submission status for each student (with concurrency limit)
  let gradedCount = 0;
  let ungradedCount = 0;
  let errorCount = 0;
  
  const feedbackResults = await processWithConcurrency(
    userIds,
    async (userId): Promise<StudentFeedback> => {
      const user = userMap.get(userId);
      const baseFeedback: StudentFeedback = {
        userId,
        lastName: user?.lastname || '',
        firstName: user?.firstname || '',
        grade: '',
        feedback: '',
      };
      
      try {
        const statusResponse = await getSubmissionStatus(assignmentId, userId);
        
        if (statusResponse.error) {
          console.warn(`[AssignmentFeedback] Error getting status for user ${userId}: ${statusResponse.error.message}`);
          errorCount++;
          return baseFeedback;
        }
        
        const feedback = statusResponse.data?.feedback;
        
        if (feedback?.grade?.grade) {
          baseFeedback.grade = feedback.grade.grade;
          gradedCount++;
        } else {
          ungradedCount++;
        }
        
        baseFeedback.feedback = extractFeedbackComment(feedback?.plugins);
        
        return baseFeedback;
      } catch (err) {
        console.error(`[AssignmentFeedback] Exception for user ${userId}:`, err);
        errorCount++;
        return baseFeedback;
      }
    },
    CONCURRENCY_LIMIT
  );
  
  const durationMs = Date.now() - startTime;
  console.log(`[AssignmentFeedback] Export completed in ${durationMs}ms: ${feedbackResults.length} students, ${gradedCount} graded, ${ungradedCount} ungraded, ${errorCount} errors`);
  
  return {
    success: true,
    data: feedbackResults,
    stats: {
      totalStudents: feedbackResults.length,
      gradedCount,
      ungradedCount,
      errorCount,
      durationMs,
    },
  };
}
