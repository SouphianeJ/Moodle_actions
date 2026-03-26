'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout';
import { Alert, Button, Card, Input, PageHeader } from '@/components/ui';

type AlertState = {
  variant: 'info' | 'success' | 'warning' | 'error';
  message: string;
} | null;

interface CourseInfo {
  id: number;
  fullname: string;
  shortname: string;
  visible: boolean;
  enrolledCount: number;
}

interface GroupInfo {
  id: number;
  name: string;
  description: string;
}

interface QuizInfo {
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

interface CourseQuizzesResponse {
  success?: boolean;
  error?: string;
  course?: CourseInfo;
  groups?: GroupInfo[];
  quizzes?: QuizInfo[];
  dataLimitations?: string[];
}

function formatDateTime(timestamp: number | null): string {
  if (!timestamp) {
    return 'Indisponible';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp * 1000));
}

function formatDuration(durationSeconds: number | null): string {
  if (!durationSeconds || durationSeconds <= 0) {
    return 'Indisponible via les WS Moodle actuellement exposes';
  }

  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} h`);
  }

  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes} min`);
  }

  return parts.join(' ');
}

export default function CourseQuizzesPage() {
  const [courseId, setCourseId] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [quizzes, setQuizzes] = useState<QuizInfo[]>([]);
  const [dataLimitations, setDataLimitations] = useState<string[]>([]);

  const handleLoad = async (e: React.FormEvent) => {
    e.preventDefault();

    const id = courseId.trim();

    if (!/^\d+$/.test(id) || Number.parseInt(id, 10) <= 0) {
      setAlert({
        variant: 'error',
        message: "L'identifiant du cours doit etre un nombre entier positif.",
      });
      return;
    }

    setLoading(true);
    setAlert(null);
    setCourse(null);
    setGroups([]);
    setQuizzes([]);
    setDataLimitations([]);

    try {
      const response = await fetch(`/api/actions/course-quizzes?courseId=${id}`);
      const data = (await response.json()) as CourseQuizzesResponse;

      if (!response.ok || !data.course) {
        throw new Error(data.error || `Erreur ${response.status}`);
      }

      setCourse(data.course);
      setGroups(data.groups || []);
      setQuizzes(data.quizzes || []);
      setDataLimitations(data.dataLimitations || []);
      setAlert({
        variant: 'success',
        message: `${(data.quizzes || []).length} quiz trouve(s) pour le cours ${data.course.id}.`,
      });
    } catch (error) {
      console.error('Error loading course quizzes:', error);
      setAlert({
        variant: 'error',
        message: error instanceof Error ? error.message : 'Impossible de charger les quiz du cours.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Voir les quiz d'un cours"
        description="Affiche les quiz d'un cours Moodle ainsi que les informations disponibles via les Web Services exposes."
      />

      <Card className="mb-6 max-w-2xl">
        <form onSubmit={handleLoad} className="flex items-end gap-4">
          <div className="flex-1">
            <Input
              type="text"
              label="ID du cours"
              placeholder="Ex: 1059"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              helper="L'ID du cours se trouve dans l'URL Moodle."
            />
          </div>
          <Button type="submit" loading={loading} disabled={!courseId.trim() || loading}>
            Charger
          </Button>
        </form>
      </Card>

      {alert && (
        <Alert variant={alert.variant} className="mb-6 max-w-4xl">
          {alert.message}
        </Alert>
      )}

      {course && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Card>
              <p className="mb-1 text-sm text-gray-500">Cours</p>
              <p className="text-lg font-semibold text-gray-900">{course.fullname}</p>
              <p className="mt-1 text-sm text-gray-500">{course.shortname || `Cours ${course.id}`}</p>
            </Card>
            <Card>
              <p className="mb-1 text-sm text-gray-500">Visibilite</p>
              <p className={`text-lg font-semibold ${course.visible ? 'text-green-700' : 'text-amber-700'}`}>
                {course.visible ? 'Visible' : 'Masque'}
              </p>
            </Card>
            <Card>
              <p className="mb-1 text-sm text-gray-500">Inscrits</p>
              <p className="text-2xl font-semibold text-gray-900">{course.enrolledCount}</p>
            </Card>
            <Card>
              <p className="mb-1 text-sm text-gray-500">Quiz</p>
              <p className="text-2xl font-semibold text-gray-900">{quizzes.length}</p>
            </Card>
            <Card>
              <p className="mb-1 text-sm text-gray-500">Groupes du cours</p>
              <p className="text-2xl font-semibold text-gray-900">{groups.length}</p>
            </Card>
          </div>

          <Alert variant="info" title="Limites detectees du service actuel" className="mb-6 max-w-5xl">
            <ul className="list-disc pl-5">
              {dataLimitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </Alert>

          <Card className="mb-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Groupes du cours</h2>
            {groups.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {groups.map((group) => (
                  <div key={group.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="font-medium text-gray-900">{group.name}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {group.description || 'Aucune description'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Aucun groupe trouve pour ce cours.</p>
            )}
          </Card>

          <div className="space-y-4">
            {quizzes.map((quiz) => (
              <Card key={quiz.cmid}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        {quiz.sectionName}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          quiz.visible
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {quiz.visible ? 'visible' : 'masque'}
                      </span>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900">{quiz.name}</h2>
                    <p className="mt-2 text-sm text-gray-500">
                      Quiz #{quiz.quizId} • CMID #{quiz.cmid}
                    </p>
                  </div>

                  {quiz.url ? (
                    <a
                      href={quiz.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      Ouvrir dans Moodle
                    </a>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Ouverture</p>
                    <p className="mt-1 text-sm text-gray-600">{formatDateTime(quiz.openAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Fermeture</p>
                    <p className="mt-1 text-sm text-gray-600">{formatDateTime(quiz.closeAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Temps imparti</p>
                    <p className="mt-1 text-sm text-gray-600">{formatDuration(quiz.durationSeconds)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Description</p>
                    <p className="mt-1 text-sm text-gray-600">
                      {quiz.description || 'Indisponible via les WS Moodle actuellement exposes'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Derogations de groupe</p>
                    <p className="mt-1 text-sm text-gray-600">
                      {quiz.groupOverridesStatus === 'unavailable_with_current_ws'
                        ? 'Indisponible via les WS Moodle actuellement exposes'
                        : quiz.groupOverridesStatus}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Banque de questions</p>
                    <p className="mt-1 text-sm text-gray-600">
                      {quiz.questionBankStatus === 'unavailable_with_current_ws'
                        ? 'Indisponible via les WS Moodle actuellement exposes'
                        : quiz.questionBankStatus}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {quizzes.length === 0 && (
            <Card className="mt-6">
              <p className="text-gray-500">Aucun quiz trouve dans ce cours.</p>
            </Card>
          )}
        </>
      )}
    </AppShell>
  );
}
