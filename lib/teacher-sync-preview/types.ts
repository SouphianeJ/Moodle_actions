export interface HyperplanningTeacherSnapshot {
  id: string;
  email: string;
  code: string;
  firstName: string;
  lastName: string;
  statut: string;
  categories: string[];
}

export interface HyperplanningCourseSnapshot {
  courseId: string;
  subject: string;
  courseType: string;
  courseDates: string[];
}

export interface MoodleUserSnapshot {
  id: number;
  firstname: string;
  lastname: string;
  email?: string;
}

export interface MoodleCourseSnapshot {
  id: number;
  shortname?: string;
  fullname?: string;
  displayname?: string;
  categoryid?: number;
  categoryname?: string;
  visible?: number;
}

export interface TeacherSyncPreviewRow {
  hyperplanningTeacher: HyperplanningTeacherSnapshot;
  moodleUser: MoodleUserSnapshot | null;
  hyperplanningCourses: HyperplanningCourseSnapshot[];
  moodleCourses: MoodleCourseSnapshot[];
  matchStatus: 'matched' | 'unmatched';
}

export interface TeacherSyncPreviewSnapshot {
  scope: string;
  academicYear: string;
  sourceWindow: {
    start: string;
    end: string;
  };
  generatedAt: string;
  rowCount: number;
  rows: TeacherSyncPreviewRow[];
}
