import 'server-only';

import { getCollection } from '@/lib/db/mongo';
import {
  getCurrentAcademicYearRange,
  getIlepsTeachersWithCoursesForRange,
} from '@/lib/hyperplanning/client';
import {
  getUserCourses,
  getUsersByEmails,
  type MoodleCourseSummary,
  type UserInfo,
} from '@/lib/moodle/client';
import type { TeacherSyncPreviewRow, TeacherSyncPreviewSnapshot } from '@/lib/teacher-sync-preview/types';

const SNAPSHOT_COLLECTION = 'teacher_sync_snapshots';
const SNAPSHOT_SCOPE = 'current-academic-year';
const CONCURRENCY_LIMIT = 5;

interface TeacherSyncPreviewSnapshotDocument extends TeacherSyncPreviewSnapshot {
  _id?: string;
  cacheKey: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrencyLimit: number,
): Promise<R[]> {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += concurrencyLimit) {
    const chunk = items.slice(index, index + concurrencyLimit);
    results.push(...(await Promise.all(chunk.map(processor))));
  }

  return results;
}

async function ensureIndexes() {
  const collection = await getCollection<TeacherSyncPreviewSnapshotDocument>(SNAPSHOT_COLLECTION);
  await Promise.all([
    collection.createIndex({ cacheKey: 1 }, { unique: true }),
    collection.createIndex({ generatedAt: -1 }),
  ]);
}

async function getLatestSnapshot(): Promise<TeacherSyncPreviewSnapshot | null> {
  const collection = await getCollection<TeacherSyncPreviewSnapshotDocument>(SNAPSHOT_COLLECTION);
  const document = await collection.findOne(
    { cacheKey: SNAPSHOT_SCOPE },
    { sort: { generatedAt: -1 } },
  );

  if (!document) {
    return null;
  }

  const snapshot = {
    scope: document.scope,
    academicYear: document.academicYear,
    sourceWindow: document.sourceWindow,
    generatedAt: document.generatedAt,
    rowCount: document.rowCount,
    rows: document.rows,
  };
  return snapshot;
}

async function storeSnapshot(snapshot: TeacherSyncPreviewSnapshot): Promise<void> {
  await ensureIndexes();

  const collection = await getCollection<TeacherSyncPreviewSnapshotDocument>(SNAPSHOT_COLLECTION);
  await collection.replaceOne(
    { cacheKey: SNAPSHOT_SCOPE },
    {
      cacheKey: SNAPSHOT_SCOPE,
      ...snapshot,
    },
    { upsert: true },
  );
}

async function buildSnapshot(): Promise<TeacherSyncPreviewSnapshot> {
  const academicYear = getCurrentAcademicYearRange();
  const hpTeachers = await getIlepsTeachersWithCoursesForRange(
    academicYear.startText,
    academicYear.endText,
  );

  const moodleUsersByEmail = new Map<string, UserInfo>();
  const uniqueEmails = Array.from(
    new Set(
      hpTeachers
        .map((teacher) => normalizeEmail(teacher.email))
        .filter(Boolean),
    ),
  );

  if (uniqueEmails.length > 0) {
    const moodleUsers = await processWithConcurrency(
      uniqueEmails,
      async (email) => {
        const response = await getUsersByEmails([email]);
        if (response.error) {
          throw new Error(`Unable to fetch Moodle user for ${email}: ${response.error.message}`);
        }

        return response.data || [];
      },
      CONCURRENCY_LIMIT,
    );

    moodleUsers.flat().forEach((user) => {
      if (user.email) {
        moodleUsersByEmail.set(normalizeEmail(user.email), user);
      }
    });
  }

  const rows = await processWithConcurrency(
    hpTeachers,
    async (teacher) => {
      const moodleUser = moodleUsersByEmail.get(normalizeEmail(teacher.email)) || null;
      let moodleCourses: MoodleCourseSummary[] = [];

      if (moodleUser) {
        const coursesResponse = await getUserCourses(moodleUser.id);
        if (coursesResponse.error) {
          throw new Error(
            `Unable to fetch Moodle courses for user ${moodleUser.id}: ${coursesResponse.error.message}`,
          );
        }
        moodleCourses = (coursesResponse.data || []).sort((left, right) =>
          (left.fullname || left.displayname || '').localeCompare(
            right.fullname || right.displayname || '',
            'fr',
          ),
        );
      }

      return {
        hyperplanningTeacher: {
          id: teacher.id,
          email: teacher.email,
          code: teacher.code,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          statut: teacher.statut,
          categories: teacher.categories,
        },
        moodleUser,
        hyperplanningCourses: teacher.courses,
        moodleCourses,
        matchStatus: moodleUser ? 'matched' : 'unmatched',
      } satisfies TeacherSyncPreviewRow;
    },
    3,
  );

  rows.sort((left, right) => {
    const lastNameCompare = left.hyperplanningTeacher.lastName.localeCompare(
      right.hyperplanningTeacher.lastName,
      'fr',
    );
    if (lastNameCompare !== 0) {
      return lastNameCompare;
    }

    return left.hyperplanningTeacher.firstName.localeCompare(
      right.hyperplanningTeacher.firstName,
      'fr',
    );
  });

  return {
    scope: SNAPSHOT_SCOPE,
    academicYear: academicYear.scope,
    sourceWindow: {
      start: academicYear.startText,
      end: academicYear.endText,
    },
    generatedAt: new Date().toISOString(),
    rowCount: rows.length,
    rows,
  };
}

export async function getTeacherSyncPreviewSnapshot(options?: {
  refresh?: boolean;
}): Promise<{ snapshot: TeacherSyncPreviewSnapshot; fromCache: boolean }> {
  if (!options?.refresh) {
    const cachedSnapshot = await getLatestSnapshot();
    if (cachedSnapshot) {
      return {
        snapshot: cachedSnapshot,
        fromCache: true,
      };
    }
  }

  const snapshot = await buildSnapshot();
  await storeSnapshot(snapshot);

  return {
    snapshot,
    fromCache: false,
  };
}
