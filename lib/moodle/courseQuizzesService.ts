import { getCollection } from '@/lib/db/mongo';
import { htmlToText } from '@/lib/text/htmlToText';
import {
  getCourseContentsDetailed,
  getCoursesByField,
  getCourseGroups,
  getEnrolledUsers,
  getQuizAccessInformation,
  getQuizAttemptData,
  getQuizRequiredQtypes,
  getQuizzesByCourses,
  getSiteInfo,
  startQuizAttempt,
  type MoodleCourseModule,
  type MoodleGroup,
  type MoodleQuiz,
  type MoodleQuizAttempt,
  type MoodleQuizAttemptDataResponse,
  type MoodleQuizAttemptQuestion,
} from './client';
import type {
  CourseQuizzesData,
  CourseQuizzesGroup,
  CourseQuizzesResponse,
} from './courseQuizzesTypes';

const PREVIEW_CACHE_COLLECTION = 'quiz_preview_cache';
const PREVIEW_EXAMPLE_LIMIT = 3;
const PREVIEW_FETCH_PAGE_LIMIT = 3;
const QUIZ_ENRICH_CONCURRENCY = 3;

export interface CourseQuizzesResult extends Omit<CourseQuizzesResponse, 'course' | 'groups' | 'quizzes' | 'dataLimitations'> {
  success: boolean;
  data?: CourseQuizzesData;
}

interface QuizPreviewCacheEntry {
  quizId: number;
  courseId: number;
  previewUserId: number;
  attemptId: number;
  attemptState: string;
  questionCount: number | null;
  questionExamples: string[];
  questionTypes: string[];
  quizTimeModified: number | null;
  lastReadSucceeded?: boolean;
  updatedAt: Date;
}

interface PreviewExtractionResult {
  questionCount: number | null;
  questionExamples: string[];
  previewSource: 'cache' | 'new_attempt' | 'unavailable';
  previewStatusMessage?: string;
}

const DATA_LIMITATIONS = [
  'Les categories de banque de questions restent indisponibles tant que les WS core_question_* ne sont pas exposes.',
  'Les derogations de groupe detaillees restent indisponibles via les WS actuellement exposes.',
  'Les exemples de questions sont extraits depuis une tentative preview Moodle et non depuis la banque de questions source.',
];

function mapGroup(group: MoodleGroup): CourseQuizzesGroup {
  return {
    id: group.id,
    name: group.name,
    description: group.description || '',
  };
}

function decodeText(value?: string | null): string | null {
  const text = htmlToText(value).trim();
  return text.length > 0 ? text : null;
}

function countLayoutQuestions(layout?: string): number | null {
  if (!layout) {
    return null;
  }

  const slots = layout
    .split(',')
    .map((item) => Number.parseInt(item, 10))
    .filter((item) => Number.isInteger(item) && item > 0);

  return slots.length > 0 ? slots.length : null;
}

function getQuestionText(question: MoodleQuizAttemptQuestion): string | null {
  const match = question.html.match(/<div class="qtext">([\s\S]*?)<\/div>/i);
  if (!match) {
    return null;
  }

  return decodeText(match[1]);
}

function getSectionNameByNumber(
  modulesByCmid: Map<number, { sectionName: string; module: MoodleCourseModule }>,
  quiz: MoodleQuiz
): string {
  const moduleInfo = modulesByCmid.get(quiz.coursemodule);
  return moduleInfo?.sectionName || 'Section sans nom';
}

function getQuizUrl(
  modulesByCmid: Map<number, { sectionName: string; module: MoodleCourseModule }>,
  quiz: MoodleQuiz
): string | undefined {
  return modulesByCmid.get(quiz.coursemodule)?.module.url;
}

async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrencyLimit: number
): Promise<R[]> {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += concurrencyLimit) {
    const chunk = items.slice(index, index + concurrencyLimit);
    const chunkResults = await Promise.all(chunk.map(processor));
    results.push(...chunkResults);
  }

  return results;
}

async function getPreviewCacheCollection() {
  return getCollection<QuizPreviewCacheEntry>(PREVIEW_CACHE_COLLECTION);
}

async function readCachedPreview(
  courseId: number,
  quiz: MoodleQuiz,
  previewUserId: number
): Promise<QuizPreviewCacheEntry | null> {
  const collection = await getPreviewCacheCollection();
  const cacheEntry = await collection.findOne({
    courseId,
    quizId: quiz.id,
    previewUserId,
  });

  if (!cacheEntry) {
    return null;
  }

  if (!cacheEntry.attemptId) {
    return null;
  }

  return cacheEntry;
}

async function writeCachedPreview(
  courseId: number,
  quiz: MoodleQuiz,
  previewUserId: number,
  attempt: MoodleQuizAttempt,
  questionCount: number | null,
  questionExamples: string[],
  questionTypes: string[]
): Promise<void> {
  const collection = await getPreviewCacheCollection();

  await collection.updateOne(
    {
      courseId,
      quizId: quiz.id,
      previewUserId,
    },
    {
      $set: {
        attemptId: attempt.id,
        attemptState: attempt.state || 'unknown',
        questionCount,
        questionExamples,
        questionTypes,
        quizTimeModified: quiz.timemodified || null,
        lastReadSucceeded: true,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        courseId,
        quizId: quiz.id,
        previewUserId,
      },
    },
    {
      upsert: true,
    }
  );
}

async function writePreviewAttemptReference(
  courseId: number,
  quiz: MoodleQuiz,
  previewUserId: number,
  attempt: MoodleQuizAttempt,
  questionTypes: string[]
): Promise<void> {
  const collection = await getPreviewCacheCollection();

  await collection.updateOne(
    {
      courseId,
      quizId: quiz.id,
      previewUserId,
    },
    {
      $set: {
        attemptId: attempt.id,
        attemptState: attempt.state || 'unknown',
        questionTypes,
        quizTimeModified: quiz.timemodified || null,
        lastReadSucceeded: false,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        courseId,
        quizId: quiz.id,
        previewUserId,
      },
    },
    {
      upsert: true,
    }
  );
}

async function markCachedPreviewReadFailure(
  courseId: number,
  quizId: number,
  previewUserId: number
): Promise<void> {
  const collection = await getPreviewCacheCollection();
  await collection.updateOne(
    {
      courseId,
      quizId,
      previewUserId,
    },
    {
      $set: {
        lastReadSucceeded: false,
        updatedAt: new Date(),
      },
    }
  );
}

async function fetchAttemptExamples(
  attemptId: number
): Promise<{ success: boolean; questionCount: number | null; questionExamples: string[] }> {
  let currentPage = 0;
  let pageCount = 0;
  let questionCount: number | null = null;
  const questionExamples: string[] = [];
  const seenQuestions = new Set<string>();

  while (pageCount < PREVIEW_FETCH_PAGE_LIMIT && questionExamples.length < PREVIEW_EXAMPLE_LIMIT) {
    const response = await getQuizAttemptData(attemptId, currentPage);
    if (response.error) {
      return {
        success: false,
        questionCount,
        questionExamples,
      };
    }

    const data = response.data as MoodleQuizAttemptDataResponse | undefined;
    const questions = data?.questions || [];

    if (questionCount === null) {
      questionCount = countLayoutQuestions(data?.attempt?.layout);
    }

    for (const question of questions) {
      const text = getQuestionText(question);
      if (!text || seenQuestions.has(text)) {
        continue;
      }

      seenQuestions.add(text);
      questionExamples.push(text);

      if (questionExamples.length >= PREVIEW_EXAMPLE_LIMIT) {
        break;
      }
    }

    if (typeof data?.nextpage !== 'number' || data.nextpage < 0 || data.nextpage === currentPage) {
      break;
    }

    currentPage = data.nextpage;
    pageCount += 1;
  }

  return {
    success: true,
    questionCount,
    questionExamples,
  };
}

async function resolvePreviewData(
  courseId: number,
  quiz: MoodleQuiz,
  previewUserId: number,
  questionTypes: string[]
): Promise<PreviewExtractionResult> {
  const cachedPreview = await readCachedPreview(courseId, quiz, previewUserId);
  if (cachedPreview) {
    const extracted = await fetchAttemptExamples(cachedPreview.attemptId);
    if (extracted.success) {
      const cachedAttempt: MoodleQuizAttempt = {
        id: cachedPreview.attemptId,
        quiz: quiz.id,
        userid: previewUserId,
        attempt: 0,
        state: cachedPreview.attemptState,
      };

      await writeCachedPreview(
        courseId,
        quiz,
        previewUserId,
        cachedAttempt,
        extracted.questionCount,
        extracted.questionExamples,
        questionTypes
      );

      return {
        questionCount: extracted.questionCount,
        questionExamples: extracted.questionExamples,
        previewSource: 'cache',
      };
    }

    await markCachedPreviewReadFailure(courseId, quiz.id, previewUserId);
  }

  const startAttemptResponse = await startQuizAttempt(quiz.id, false);
  let newAttempt = startAttemptResponse.data?.attempt;

  if (!newAttempt) {
    if (startAttemptResponse.error?.errorcode === 'attemptstillinprogress') {
      const forcedStartAttemptResponse = await startQuizAttempt(quiz.id, true);
      newAttempt = forcedStartAttemptResponse.data?.attempt;

      if (!newAttempt) {
        return {
          questionCount: quiz.sumgrades ?? null,
          questionExamples: [],
          previewSource: 'unavailable',
          previewStatusMessage: forcedStartAttemptResponse.error?.message
            || 'Une tentative preview Moodle existe deja mais n a pas pu etre recreee automatiquement.',
        };
      }
    } else {
      return {
        questionCount: quiz.sumgrades ?? null,
        questionExamples: [],
        previewSource: 'unavailable',
        previewStatusMessage: startAttemptResponse.error?.message || 'Impossible de creer ou reutiliser une tentative preview.',
      };
    }
  }

  await writePreviewAttemptReference(courseId, quiz, previewUserId, newAttempt, questionTypes);
  const extracted = await fetchAttemptExamples(newAttempt.id);
  if (!extracted.success) {
    return {
      questionCount: quiz.sumgrades ?? null,
      questionExamples: [],
      previewSource: 'unavailable',
      previewStatusMessage: 'La tentative preview a ete creee mais la lecture des questions a echoue.',
    };
  }

  await writeCachedPreview(
    courseId,
    quiz,
    previewUserId,
    newAttempt,
    extracted.questionCount,
    extracted.questionExamples,
    questionTypes
  );

  return {
    questionCount: extracted.questionCount,
    questionExamples: extracted.questionExamples,
    previewSource: 'new_attempt',
  };
}

export async function getCourseQuizzesOverview(courseId: number): Promise<CourseQuizzesResult> {
  const [courseResponse, enrolledUsersResponse, contentsResponse, groupsResponse, quizzesResponse, siteInfoResponse] = await Promise.all([
    getCoursesByField('id', courseId),
    getEnrolledUsers(courseId),
    getCourseContentsDetailed(courseId),
    getCourseGroups(courseId),
    getQuizzesByCourses([courseId]),
    getSiteInfo(),
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
      error: `Impossible de recuperer le contenu du cours: ${contentsResponse.error.message}`,
    };
  }

  if (groupsResponse.error) {
    return {
      success: false,
      error: `Impossible de recuperer les groupes du cours: ${groupsResponse.error.message}`,
    };
  }

  if (quizzesResponse.error) {
    return {
      success: false,
      error: `Impossible de recuperer les metadonnees des quiz: ${quizzesResponse.error.message}`,
    };
  }

  if (siteInfoResponse.error || !siteInfoResponse.data?.userid) {
    return {
      success: false,
      error: `Impossible de recuperer l'identite du token Moodle: ${siteInfoResponse.error?.message || 'userid manquant'}`,
    };
  }

  const course = courseResponse.data?.courses?.[0];
  if (!course) {
    return {
      success: false,
      error: 'Cours introuvable.',
    };
  }

  const modulesByCmid = new Map<number, { sectionName: string; module: MoodleCourseModule }>();
  for (const section of contentsResponse.data || []) {
    for (const courseModule of section.modules || []) {
      modulesByCmid.set(courseModule.id, {
        sectionName: section.name || 'Section sans nom',
        module: courseModule,
      });
    }
  }

  const previewUserId = siteInfoResponse.data.userid;
  const quizzes = await processWithConcurrency(
    quizzesResponse.data?.quizzes || [],
    async (quiz) => {
      const [accessInfoResponse, qtypesResponse] = await Promise.all([
        getQuizAccessInformation(quiz.id),
        getQuizRequiredQtypes(quiz.id),
      ]);

      const questionTypes = qtypesResponse.data?.questiontypes || [];
      const previewData = await resolvePreviewData(courseId, quiz, previewUserId, questionTypes);

      return {
        cmid: quiz.coursemodule,
        quizId: quiz.id,
        sectionName: getSectionNameByNumber(modulesByCmid, quiz),
        name: quiz.name,
        visible: Boolean(quiz.visible),
        url: getQuizUrl(modulesByCmid, quiz),
        openAt: quiz.timeopen || null,
        closeAt: quiz.timeclose || null,
        durationSeconds: quiz.timelimit || null,
        description: decodeText(quiz.intro),
        questionCount: previewData.questionCount ?? quiz.sumgrades ?? null,
        requiredQuestionTypes: questionTypes,
        questionExamples: previewData.questionExamples,
        accessRules: accessInfoResponse.data?.accessrules || [],
        preventAccessReasons: accessInfoResponse.data?.preventaccessreasons || [],
        previewSource: previewData.previewSource,
        previewStatusMessage: previewData.previewStatusMessage,
        groupOverridesStatus: 'unavailable_with_current_ws' as const,
        questionBankStatus: 'preview_questions_only_until_core_question_ws' as const,
      };
    },
    QUIZ_ENRICH_CONCURRENCY
  );

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
