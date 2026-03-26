import {
  getCourseContentsDetailed,
  getCoursesByField,
  getCourseGroups,
  getEnrolledUsers,
  type MoodleCourseModule,
  type MoodleGroup,
} from './client';

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
  groupOverridesStatus: 'unavailable_with_current_ws';
  questionBankStatus: 'unavailable_with_current_ws';
}

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

export interface CourseQuizzesData {
  course: CourseQuizzesCourse;
  groups: CourseQuizzesGroup[];
  quizzes: CourseQuizSummary[];
  dataLimitations: string[];
}

export interface CourseQuizzesResult {
  success: boolean;
  data?: CourseQuizzesData;
  error?: string;
}

interface ParsedQuizTiming {
  openAt: number | null;
  closeAt: number | null;
}

const DATA_LIMITATIONS = [
  'Le service Web actuel n’expose pas mod_quiz_get_quizzes_by_courses.',
  'Le service Web actuel n’expose pas mod_quiz_get_quiz_access_information.',
  'Le service Web actuel n’expose pas les fonctions core_question_*.',
  'Les descriptions, dérogations de groupe, catégories de questions et exemples ne sont donc pas disponibles via les WS actuels.',
];

function parseCustomData(customdata?: string | null): Record<string, unknown> {
  if (!customdata) {
    return {};
  }

  try {
    const parsed = JSON.parse(customdata) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function getTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number.parseInt(value, 10);
    return parsed > 0 ? parsed : null;
  }

  return null;
}

function parseQuizTiming(module: MoodleCourseModule): ParsedQuizTiming {
  let openAt: number | null = null;
  let closeAt: number | null = null;

  for (const date of module.dates || []) {
    if (date.dataid === 'timeopen' && !openAt) {
      openAt = getTimestamp(date.timestamp);
    }

    if (date.dataid === 'timeclose' && !closeAt) {
      closeAt = getTimestamp(date.timestamp);
    }
  }

  const customData = parseCustomData(module.customdata);

  if (!openAt) {
    openAt = getTimestamp(customData.timeopen);
  }

  if (!closeAt) {
    closeAt = getTimestamp(customData.timeclose);
  }

  return { openAt, closeAt };
}

function mapGroup(group: MoodleGroup): CourseQuizzesGroup {
  return {
    id: group.id,
    name: group.name,
    description: group.description || '',
  };
}

export async function getCourseQuizzesOverview(courseId: number): Promise<CourseQuizzesResult> {
  const [courseResponse, enrolledUsersResponse, contentsResponse, groupsResponse] = await Promise.all([
    getCoursesByField('id', courseId),
    getEnrolledUsers(courseId),
    getCourseContentsDetailed(courseId),
    getCourseGroups(courseId),
  ]);

  if (courseResponse.error) {
    return {
      success: false,
      error: `Impossible de recuperer le cours: ${courseResponse.error.message}`,
    };
  }

  if (enrolledUsersResponse.error) {
    return {
      success: false,
      error: `Impossible de recuperer les inscrits: ${enrolledUsersResponse.error.message}`,
    };
  }

  if (contentsResponse.error) {
    return {
      success: false,
      error: `Impossible de recuperer les quiz du cours: ${contentsResponse.error.message}`,
    };
  }

  if (groupsResponse.error) {
    return {
      success: false,
      error: `Impossible de recuperer les groupes du cours: ${groupsResponse.error.message}`,
    };
  }

  const course = courseResponse.data?.courses?.[0];

  if (!course) {
    return {
      success: false,
      error: 'Cours introuvable.',
    };
  }

  const quizzes: CourseQuizSummary[] = [];

  for (const section of contentsResponse.data || []) {
    for (const courseModule of section.modules || []) {
      if (courseModule.modname !== 'quiz') {
        continue;
      }

      const { openAt, closeAt } = parseQuizTiming(courseModule);

      quizzes.push({
        cmid: courseModule.id,
        quizId: courseModule.instance,
        sectionName: section.name || 'Section sans nom',
        name: courseModule.name,
        visible: courseModule.visible !== 0,
        url: courseModule.url,
        openAt,
        closeAt,
        durationSeconds: null,
        description: null,
        groupOverridesStatus: 'unavailable_with_current_ws',
        questionBankStatus: 'unavailable_with_current_ws',
      });
    }
  }

  return {
    success: true,
    data: {
      course: {
        id: course.id,
        fullname: course.fullname || course.displayname || `Cours ${course.id}`,
        shortname: course.shortname || '',
        visible: course.visible !== 0,
        enrolledCount: enrolledUsersResponse.data?.length || 0,
      },
      groups: (groupsResponse.data || []).map(mapGroup),
      quizzes,
      dataLimitations: DATA_LIMITATIONS,
    },
  };
}
