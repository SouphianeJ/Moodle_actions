/**
 * Moodle Web Service Client
 * 
 * This client provides a foundation for making calls to Moodle Web Services.
 * The actual endpoint implementations will be added as features are developed.
 */

const MOODLE_BASE_URL = process.env.MOODLE_BASE_URL;
const MOODLE_WS_TOKEN = process.env.MOODLE_WS_TOKEN;

interface MoodleResponse<T = unknown> {
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
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

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
    return {
      error: { message: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

/**
 * TODO: Orchestrator function to get assignment feedback
 * 
 * This function will:
 * 1. Get assignment details using mod_assign_get_assignments
 * 2. Get submissions using mod_assign_get_submissions
 * 3. Get grades using mod_assign_get_grades
 * 4. Aggregate and format the feedback data
 * 
 * @param assignmentId - The assignment/evaluation ID
 * @returns Aggregated feedback data
 */
export async function getAssignmentFeedback(assignmentId: number) {
  // TODO: Implement the orchestration logic
  // This will involve multiple API calls and data aggregation
  console.log('getAssignmentFeedback called with:', assignmentId);
  
  return {
    success: false,
    message: 'Not implemented yet',
  };
}
