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

// ===== Course contents types =====

export interface CourseModule {
  id: number; // cmid (course module id)
  instance: number; // assignid for assign modules
  modname: string;
  name: string;
  visible?: number;
  url?: string;
}

export interface CourseSection {
  id: number;
  name: string;
  modules: CourseModule[];
}

export type CourseContentsResponse = CourseSection[];

// ===== Submission file types =====

export interface SubmissionFile {
  filename: string;
  filepath: string;
  filesize: number;
  fileurl: string;
  mimetype: string;
  timemodified?: number;
}

export interface SubmissionPlugin {
  type: string;
  name: string;
  fileareas?: Array<{
    area: string;
    files: SubmissionFile[];
  }>;
}

export interface SubmissionAttempt {
  id: number;
  userid: number;
  status: string;
  attemptnumber: number;
  timemodified: number;
  plugins?: SubmissionPlugin[];
}

export interface SubmissionStatusFullResponse {
  lastattempt?: {
    submission?: SubmissionAttempt;
    submissiongroupmemberswhoneedtosubmit?: number[];
    teamsubmission?: SubmissionAttempt;
  };
  feedback?: {
    grade?: {
      grade: string;
      gradefordisplay?: string;
    };
    plugins?: FeedbackPlugin[];
  };
  warnings?: Array<{ warningcode: string; message: string }>;
}

// ===== Enrolled users types =====

export interface EnrolledUser {
  id: number;
  firstname: string;
  lastname: string;
  email?: string;
  roles?: Array<{
    roleid: number;
    name: string;
    shortname: string;
  }>;
}

export interface EnrolledUsersByCmidResponse {
  users?: EnrolledUser[];
  warnings?: Array<{ warningcode: string; message: string }>;
}

export interface UsersResponse {
  users?: UserInfo[];
  warnings?: Array<{ warningcode: string; message: string }>;
}

export interface MoodleCourseSummary {
  id: number;
  shortname?: string;
  fullname?: string;
  displayname?: string;
  categoryid?: number;
  categoryname?: string;
  visible?: number;
}

export interface MoodleCourseDetailsResponse {
  courses?: MoodleCourseSummary[];
  warnings?: Array<{ warningcode: string; message: string }>;
}

export interface MoodleGroup {
  id: number;
  name: string;
  description?: string;
}

export interface MoodleModuleDate {
  label?: string;
  timestamp?: number;
  dataid?: string;
}

export interface MoodleCourseModule extends CourseModule {
  contextid?: number;
  uservisible?: boolean;
  visibleoncoursepage?: number;
  customdata?: string | null;
  dates?: MoodleModuleDate[];
}

export interface MoodleCourseSectionWithDetails {
  id: number;
  name: string;
  modules: MoodleCourseModule[];
}

export type MoodleCourseContentsDetailedResponse = MoodleCourseSectionWithDetails[];

export interface MoodleSiteInfoFunction {
  name: string;
}

export interface MoodleSiteInfo {
  sitename?: string;
  username?: string;
  userid?: number;
  functions?: MoodleSiteInfoFunction[];
}

export interface MoodleQuiz {
  id: number;
  course: number;
  coursemodule: number;
  name: string;
  intro?: string;
  introformat?: number;
  visible?: boolean;
  section?: number;
  groupmode?: number;
  groupingid?: number;
  timeopen?: number;
  timeclose?: number;
  timelimit?: number;
  preferredbehaviour?: string;
  attempts?: number;
  grademethod?: number;
  questiondecimalpoints?: number;
  shuffleanswers?: number;
  sumgrades?: number;
  grade?: number;
  timecreated?: number;
  timemodified?: number;
  hasfeedback?: number;
  hasquestions?: number;
}

export interface MoodleQuizzesByCoursesResponse {
  quizzes?: MoodleQuiz[];
  warnings?: Array<{ warningcode: string; message: string }>;
}

export interface MoodleQuizAccessInformation {
  canattempt?: boolean;
  canmanage?: boolean;
  canpreview?: boolean;
  canreviewmyattempts?: boolean;
  canviewreports?: boolean;
  accessrules?: string[];
  activerulenames?: string[];
  preventaccessreasons?: string[];
  warnings?: Array<{ warningcode: string; message: string }>;
}

export interface MoodleQuizRequiredQtypesResponse {
  questiontypes?: string[];
  warnings?: Array<{ warningcode: string; message: string }>;
}

export interface MoodleQuizAttempt {
  id: number;
  quiz: number;
  userid: number;
  attempt: number;
  uniqueid?: number;
  layout?: string;
  currentpage?: number;
  preview?: number;
  state?: string;
  timestart?: number;
  timefinish?: number;
  timemodified?: number;
  timemodifiedoffline?: number;
  sumgrades?: number | null;
}

export interface MoodleQuizUserAttemptsResponse {
  attempts?: MoodleQuizAttempt[];
  warnings?: Array<{ warningcode: string; message: string }>;
}

export interface MoodleQuizStartAttemptResponse {
  attempt?: MoodleQuizAttempt;
  warnings?: Array<{ warningcode: string; message: string }>;
}

export interface MoodleQuizAttemptQuestion {
  slot: number;
  type: string;
  page: number;
  html: string;
  status?: string;
  number?: number;
  maxmark?: number;
}

export interface MoodleQuizAttemptDataResponse {
  attempt?: MoodleQuizAttempt;
  messages?: string[];
  nextpage?: number;
  questions?: MoodleQuizAttemptQuestion[];
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

/**
 * Gets users by their email addresses
 */
export async function getUsersByEmails(emails: string[]): Promise<MoodleResponse<UserInfo[]>> {
  const params: Record<string, string | number> = {
    field: 'email',
  };

  emails.forEach((email, index) => {
    params[`values[${index}]`] = email;
  });

  return callMoodleWS<UserInfo[]>('core_user_get_users_by_field', params);
}

/**
 * Gets course contents (sections and modules) for a course
 */
export async function getCourseContents(courseId: number): Promise<MoodleResponse<CourseContentsResponse>> {
  return callMoodleWS<CourseContentsResponse>('core_course_get_contents', { courseid: courseId });
}

/**
 * Gets course contents with module details such as dates/customdata.
 */
export async function getCourseContentsDetailed(courseId: number): Promise<MoodleResponse<MoodleCourseContentsDetailedResponse>> {
  return callMoodleWS<MoodleCourseContentsDetailedResponse>('core_course_get_contents', { courseid: courseId });
}

/**
 * Gets full submission status including file information for a specific user and assignment
 */
export async function getSubmissionStatusFull(assignmentId: number, userId: number): Promise<MoodleResponse<SubmissionStatusFullResponse>> {
  return callMoodleWS<SubmissionStatusFullResponse>('mod_assign_get_submission_status', {
    assignid: assignmentId,
    userid: userId,
  });
}

/**
 * Gets enrolled users for a course that can submit assignments
 */
export async function getEnrolledUsersByCourseId(courseId: number): Promise<MoodleResponse<EnrolledUser[]>> {
  return callMoodleWS<EnrolledUser[]>('core_enrol_get_enrolled_users_with_capability', {
    'coursecapabilities[0][courseid]': courseId,
    'coursecapabilities[0][capabilities][0]': 'mod/assign:submit',
  });
}

/**
 * Gets the list of courses a user is enrolled in
 */
export async function getUserCourses(userId: number): Promise<MoodleResponse<MoodleCourseSummary[]>> {
  return callMoodleWS<MoodleCourseSummary[]>('core_enrol_get_users_courses', {
    userid: userId,
  });
}

/**
 * Gets course details by a field value.
 */
export async function getCoursesByField(
  field: 'id' | 'shortname' | 'idnumber',
  value: string | number
): Promise<MoodleResponse<MoodleCourseDetailsResponse>> {
  return callMoodleWS<MoodleCourseDetailsResponse>('core_course_get_courses_by_field', {
    field,
    value,
  });
}

/**
 * Gets all enrolled users for a course.
 */
export async function getEnrolledUsers(courseId: number): Promise<MoodleResponse<EnrolledUser[]>> {
  return callMoodleWS<EnrolledUser[]>('core_enrol_get_enrolled_users', {
    courseid: courseId,
  });
}

/**
 * Gets groups for a course.
 */
export async function getCourseGroups(courseId: number): Promise<MoodleResponse<MoodleGroup[]>> {
  return callMoodleWS<MoodleGroup[]>('core_group_get_course_groups', {
    courseid: courseId,
  });
}

/**
 * Gets site information for the current token.
 */
export async function getSiteInfo(): Promise<MoodleResponse<MoodleSiteInfo>> {
  return callMoodleWS<MoodleSiteInfo>('core_webservice_get_site_info');
}

/**
 * Gets quizzes for one or more courses.
 */
export async function getQuizzesByCourses(courseIds: number[]): Promise<MoodleResponse<MoodleQuizzesByCoursesResponse>> {
  const params: Record<string, string | number> = {};
  courseIds.forEach((courseId, index) => {
    params[`courseids[${index}]`] = courseId;
  });

  return callMoodleWS<MoodleQuizzesByCoursesResponse>('mod_quiz_get_quizzes_by_courses', params);
}

/**
 * Gets access information for a quiz.
 */
export async function getQuizAccessInformation(quizId: number): Promise<MoodleResponse<MoodleQuizAccessInformation>> {
  return callMoodleWS<MoodleQuizAccessInformation>('mod_quiz_get_quiz_access_information', {
    quizid: quizId,
  });
}

/**
 * Gets the question types required by a quiz.
 */
export async function getQuizRequiredQtypes(quizId: number): Promise<MoodleResponse<MoodleQuizRequiredQtypesResponse>> {
  return callMoodleWS<MoodleQuizRequiredQtypesResponse>('mod_quiz_get_quiz_required_qtypes', {
    quizid: quizId,
  });
}

/**
 * Gets attempts for a user on a quiz.
 */
export async function getQuizUserAttempts(
  quizId: number,
  userId: number,
  status: 'all' | 'finished' | 'unfinished' = 'all'
): Promise<MoodleResponse<MoodleQuizUserAttemptsResponse>> {
  return callMoodleWS<MoodleQuizUserAttemptsResponse>('mod_quiz_get_user_attempts', {
    quizid: quizId,
    userid: userId,
    status,
  });
}

/**
 * Starts a preview attempt for a quiz.
 */
export async function startQuizAttempt(
  quizId: number,
  forceNew = false
): Promise<MoodleResponse<MoodleQuizStartAttemptResponse>> {
  return callMoodleWS<MoodleQuizStartAttemptResponse>('mod_quiz_start_attempt', {
    quizid: quizId,
    forcenew: forceNew,
  });
}

/**
 * Gets rendered question data for one attempt page.
 */
export async function getQuizAttemptData(
  attemptId: number,
  page: number
): Promise<MoodleResponse<MoodleQuizAttemptDataResponse>> {
  return callMoodleWS<MoodleQuizAttemptDataResponse>('mod_quiz_get_attempt_data', {
    attemptid: attemptId,
    page,
  });
}

/**
 * Gets the Moodle token for file access
 */
export function getMoodleToken(): string | undefined {
  return MOODLE_WS_TOKEN;
}

/**
 * Gets the Moodle base URL
 */
export function getMoodleBaseUrl(): string | undefined {
  return MOODLE_BASE_URL;
}
