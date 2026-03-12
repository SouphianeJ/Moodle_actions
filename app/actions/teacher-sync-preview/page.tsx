'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout';
import { Alert, Button, Card, PageHeader } from '@/components/ui';
import type { TeacherSyncPreviewSnapshot } from '@/lib/teacher-sync-preview/types';

interface ApiResponse {
  success?: boolean;
  fromCache?: boolean;
  snapshot?: TeacherSyncPreviewSnapshot;
  error?: string;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatCourseLabel(course: {
  id?: number;
  fullname?: string;
  displayname?: string;
  shortname?: string;
  courseId?: string;
  subject?: string;
  courseType?: string;
}) {
  if ('id' in course) {
    return `${course.fullname || course.displayname || course.shortname || `Cours ${course.id}`} (${course.id})`;
  }

  const suffix = course.courseType ? ` - ${course.courseType}` : '';
  return `${course.subject || `Cours ${course.courseId}`}${suffix} (${course.courseId})`;
}

export default function TeacherSyncPreviewPage() {
  const [snapshot, setSnapshot] = useState<TeacherSyncPreviewSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(`/api/actions/teacher-sync-preview${refresh ? '?refresh=true' : ''}`);
      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.snapshot) {
        throw new Error(data.error || `Erreur ${response.status}`);
      }

      setSnapshot(data.snapshot);
      setFromCache(Boolean(data.fromCache));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger le tableau de synchronisation.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadSnapshot(false);
  }, []);

  const matchedCount = snapshot?.rows.filter((row) => row.matchStatus === 'matched').length || 0;
  const unmatchedCount = snapshot ? snapshot.rowCount - matchedCount : 0;

  return (
    <AppShell>
      <PageHeader
        title="Prévisualisation sync enseignants"
        description="Compare les enseignants ILEPS Hyperplanning avec les comptes et cours Moodle, sans aucune modification."
      >
        <Button
          variant="secondary"
          onClick={() => void loadSnapshot(true)}
          loading={refreshing}
        >
          Rafraîchir le snapshot
        </Button>
      </PageHeader>

      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      {loading ? (
        <Card>
          <p className="text-gray-600">Chargement du snapshot en cours...</p>
        </Card>
      ) : null}

      {snapshot ? (
        <>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <p className="text-sm text-gray-500 mb-1">Enseignants ILEPS</p>
              <p className="text-2xl font-semibold text-gray-900">{snapshot.rowCount}</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500 mb-1">Matchés Moodle</p>
              <p className="text-2xl font-semibold text-gray-900">{matchedCount}</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500 mb-1">Non matchés</p>
              <p className="text-2xl font-semibold text-gray-900">{unmatchedCount}</p>
            </Card>
          </div>

          <Card className="mb-6">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
              <span>Année académique: {snapshot.academicYear}</span>
              <span>Période: {snapshot.sourceWindow.start} → {snapshot.sourceWindow.end}</span>
              <span>Généré: {formatDateTime(snapshot.generatedAt)}</span>
              <span>Source: {fromCache ? 'cache Mongo' : 'refresh direct'}</span>
            </div>
          </Card>

          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Enseignant HP</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Compte Moodle</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Cours Hyperplanning</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Cours Moodle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {snapshot.rows.map((row) => (
                    <tr key={row.hyperplanningTeacher.id} className="align-top">
                      <td className="px-4 py-4 text-sm text-gray-700">
                        <div className="font-medium text-gray-900">
                          {row.hyperplanningTeacher.lastName} {row.hyperplanningTeacher.firstName}
                        </div>
                        <div>{row.hyperplanningTeacher.email}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          HP #{row.hyperplanningTeacher.id}
                          {row.hyperplanningTeacher.code ? ` - ${row.hyperplanningTeacher.code}` : ''}
                        </div>
                        {row.hyperplanningTeacher.statut ? (
                          <div className="text-xs text-gray-500 mt-1">
                            Statut: {row.hyperplanningTeacher.statut}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {row.moodleUser ? (
                          <>
                            <div className="font-medium text-gray-900">
                              {row.moodleUser.lastname} {row.moodleUser.firstname}
                            </div>
                            <div>{row.moodleUser.email || '-'}</div>
                            <div className="text-xs text-green-700 mt-1">Match exact par email</div>
                          </>
                        ) : (
                          <div className="text-amber-700 font-medium">Aucun compte Moodle trouvé</div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {row.hyperplanningCourses.length > 0 ? (
                          <ul className="space-y-2">
                            {row.hyperplanningCourses.map((course) => (
                              <li key={course.courseId}>
                                <div>{formatCourseLabel(course)}</div>
                                {course.courseDates.length > 0 ? (
                                  <div className="text-xs text-gray-500">
                                    {course.courseDates.join(', ')}
                                  </div>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-gray-400">Aucun cours Hyperplanning</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {row.moodleCourses.length > 0 ? (
                          <ul className="space-y-2">
                            {row.moodleCourses.map((course) => (
                              <li key={course.id}>
                                <div>{formatCourseLabel(course)}</div>
                                {course.shortname ? (
                                  <div className="text-xs text-gray-500">{course.shortname}</div>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-gray-400">Aucun cours Moodle</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </AppShell>
  );
}
