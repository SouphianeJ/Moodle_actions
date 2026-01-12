/**
 * Moodle Web Service Client
 * 
 * This client provides a foundation for making calls to Moodle Web Services.
 * The actual endpoint implementations will be added as features are developed.
 */

const MOODLE_BASE_URL = process.env.MOODLE_BASE_URL;
const MOODLE_WS_TOKEN = process.env.MOODLE_WS_TOKEN;

// Request timeout in milliseconds
const REQUEST_TIMEOUT = 30000;

export interface MoodleResponse<T = unknown> {
  data?: T;
  error?: {
    message: string;
    errorcode?: string;
  };
}

/**
 * Makes a request to the Moodle Web Service API
 * 
 * @param wsfunction - The Moodle web service function to call
 * @param params - Additional parameters for the function
 * @returns The response from Moodle
 */
export async function callMoodleWS<T = unknown>(
  wsfunction: string,
  params: Record<string, string | number | boolean> = {}
): Promise<MoodleResponse<T>> {
  if (!MOODLE_BASE_URL || !MOODLE_WS_TOKEN) {
    return {
      error: { message: 'Moodle configuration is incomplete' },
    };
  }

  const url = new URL('/webservice/rest/server.php', MOODLE_BASE_URL);
  url.searchParams.set('wstoken', MOODLE_WS_TOKEN);
  url.searchParams.set('wsfunction', wsfunction);
  url.searchParams.set('moodlewsrestformat', 'json');

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        error: { message: `HTTP error: ${response.status}` },
      };
    }

    const data = await response.json() as T;

    // Check for Moodle error response
    if (data && typeof data === 'object' && 'exception' in data) {
      const errorData = data as { message?: string; errorcode?: string };
      return {
        error: {
          message: errorData.message || 'Unknown Moodle error',
          errorcode: errorData.errorcode,
        },
      };
    }

    return { data };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        error: { message: 'Request timeout' },
      };
    }
    return {
      error: { message: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

// ===== Type definitions for Moodle WS responses =====

export interface CourseModuleResponse {
  cm?: {
    id: number;
    instance: number;
    modname: string;
    name?: string;
  };
  warnings?: Array<{ warningcode: string; message: string }>;
}

export interface Submission {
  id: number;
  userid: number;
  status: string;
  gradingstatus?: string;
}

export interface SubmissionsResponse {
  assignments?: Array<{
    assignmentid: number;
    submissions: Submission[];
  }>;
  warnings?: Array<{ warningcode: string; message: string }>;
}

export interface FeedbackPlugin {
  type: string;
  name: string;
  editorfields?: Array<{
    name: string;
    description: string;
    text: string;
    format: number;
  }>;
}

export interface SubmissionStatusResponse {
  feedback?: {
    grade?: {
      grade: string;
      gradefordisplay?: string;
    };
    plugins?: FeedbackPlugin[];
  };
  warnings?: Array<{ warningcode: string; message: string }>;
}

export interface UserInfo {
  id: number;
  firstname: string;
  lastname: string;
  email?: string;
}

export interface UsersResponse {
  users?: UserInfo[];
  warnings?: Array<{ warningcode: string; message: string }>;
}

// ===== Typed helper functions for specific WS calls =====

/**
 * Gets course module information from cmid
 */
export async function getCourseModule(cmid: number): Promise<MoodleResponse<CourseModuleResponse>> {
  return callMoodleWS<CourseModuleResponse>('core_course_get_course_module', { cmid });
}

/**
 * Gets submissions for an assignment
 */
export async function getAssignmentSubmissions(assignmentId: number): Promise<MoodleResponse<SubmissionsResponse>> {
  return callMoodleWS<SubmissionsResponse>('mod_assign_get_submissions', { 'assignmentids[0]': assignmentId });
}

/**
 * Gets submission status for a specific user and assignment
 */
export async function getSubmissionStatus(assignmentId: number, userId: number): Promise<MoodleResponse<SubmissionStatusResponse>> {
  return callMoodleWS<SubmissionStatusResponse>('mod_assign_get_submission_status', {
    assignid: assignmentId,
    userid: userId,
  });
}

/**
 * Gets users by their IDs
 */
export async function getUsersByIds(userIds: number[]): Promise<MoodleResponse<UserInfo[]>> {
  // Moodle's core_user_get_users_by_field accepts a field and values
  const params: Record<string, string | number> = {
    field: 'id',
  };
  
  userIds.forEach((id, index) => {
    params[`values[${index}]`] = id;
  });
  
  return callMoodleWS<UserInfo[]>('core_user_get_users_by_field', params);
}
