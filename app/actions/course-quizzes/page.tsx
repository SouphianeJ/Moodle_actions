'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout';
import { Alert, Button, Card, Input, PageHeader } from '@/components/ui';
import { CourseQuizzesResults } from '@/components/course-quizzes/CourseQuizzesResults';
import type { CourseQuizzesResponse } from '@/lib/moodle/courseQuizzesTypes';

type AlertState = {
  variant: 'info' | 'success' | 'warning' | 'error';
  message: string;
} | null;

export default function CourseQuizzesPage() {
  const [courseId, setCourseId] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);
  const [data, setData] = useState<CourseQuizzesResponse | null>(null);

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
    setData(null);

    try {
      const response = await fetch(`/api/actions/course-quizzes?courseId=${id}`);
      const payload = (await response.json()) as CourseQuizzesResponse;

      if (!response.ok || !payload.course) {
        throw new Error(payload.error || `Erreur ${response.status}`);
      }

      setData(payload);
      setAlert({
        variant: 'success',
        message: `${(payload.quizzes || []).length} quiz trouve(s) pour le cours ${payload.course.id}.`,
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

      {data?.course && data.groups && data.quizzes && data.dataLimitations ? (
        <CourseQuizzesResults
          course={data.course}
          groups={data.groups}
          quizzes={data.quizzes}
          dataLimitations={data.dataLimitations}
        />
      ) : null}
    </AppShell>
  );
}
