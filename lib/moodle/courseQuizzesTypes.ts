export interface CourseQuizzesCourse {
  id: number;
  fullname: string;
  shortname: string;
  visible: boolean;
  enrolledCount: number;
}

export interface CourseQuizzesGroup {
  id: number;
  name: string;
  description: string;
}

export interface CourseQuizSummary {
  cmid: number;
  quizId: number;
  sectionName: string;
  name: string;
  visible: boolean;
  url?: string;
  openAt: number | null;
  closeAt: number | null;
  durationSeconds: number | null;
  description: string | null;
  questionCount: number | null;
  requiredQuestionTypes: string[];
  questionExamples: string[];
  accessRules: string[];
  preventAccessReasons: string[];
  previewSource: 'cache' | 'new_attempt' | 'unavailable';
  previewStatusMessage?: string;
  groupOverridesStatus: 'unavailable_with_current_ws';
  questionBankStatus: 'preview_questions_only_until_core_question_ws';
}

export interface CourseQuizzesData {
  course: CourseQuizzesCourse;
  groups: CourseQuizzesGroup[];
  quizzes: CourseQuizSummary[];
  dataLimitations: string[];
}

export interface CourseQuizzesResponse extends Partial<CourseQuizzesData> {
  success?: boolean;
  error?: string;
}
