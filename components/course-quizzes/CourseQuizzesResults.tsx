'use client';

import { useState } from 'react';
import { Alert, Button, Card, Checkbox } from '@/components/ui';
import type { CourseQuizSummary, CourseQuizzesCourse, CourseQuizzesGroup } from '@/lib/moodle/courseQuizzesTypes';

type ViewMode = 'cards' | 'table';

type ColumnKey =
  | 'name'
  | 'section'
  | 'visible'
  | 'openAt'
  | 'closeAt'
  | 'duration'
  | 'questionCount'
  | 'questionExamples'
  | 'previewSource'
  | 'description'
  | 'questionTypes'
  | 'accessRules'
  | 'preventAccessReasons'
  | 'questionBankStatus'
  | 'groupOverrides'
  | 'url';

interface ColumnDefinition {
  key: ColumnKey;
  label: string;
}

interface CourseQuizzesResultsProps {
  course: CourseQuizzesCourse;
  groups: CourseQuizzesGroup[];
  quizzes: CourseQuizSummary[];
  dataLimitations: string[];
}

const DEFAULT_COLUMNS: ColumnKey[] = [
  'name',
  'section',
  'visible',
  'openAt',
  'closeAt',
  'duration',
  'questionCount',
  'questionExamples',
  'previewSource',
];

const ALL_COLUMNS: ColumnDefinition[] = [
  { key: 'name', label: 'Nom' },
  { key: 'section', label: 'Section' },
  { key: 'visible', label: 'Visible' },
  { key: 'openAt', label: 'Ouverture' },
  { key: 'closeAt', label: 'Fermeture' },
  { key: 'duration', label: 'Temps imparti' },
  { key: 'questionCount', label: 'Nb questions' },
  { key: 'questionExamples', label: 'Exemples' },
  { key: 'previewSource', label: 'Source preview' },
  { key: 'description', label: 'Description' },
  { key: 'questionTypes', label: 'Types de questions' },
  { key: 'accessRules', label: 'Regles d acces' },
  { key: 'preventAccessReasons', label: 'Restrictions' },
  { key: 'questionBankStatus', label: 'Banque de questions' },
  { key: 'groupOverrides', label: 'Derogations de groupe' },
  { key: 'url', label: 'Lien Moodle' },
];

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

function formatPreviewSource(quiz: CourseQuizSummary): string {
  const sourceLabel = quiz.previewSource === 'cache'
    ? 'cache'
    : quiz.previewSource === 'new_attempt'
      ? 'nouvelle tentative preview'
      : 'indisponible';

  if (quiz.previewStatusMessage) {
    return `${sourceLabel} - ${quiz.previewStatusMessage}`;
  }

  return sourceLabel;
}

function renderTableCell(column: ColumnKey, quiz: CourseQuizSummary) {
  switch (column) {
    case 'name':
      return (
        <div>
          <div className="font-medium text-gray-900">{quiz.name}</div>
          <div className="text-xs text-gray-500">Quiz #{quiz.quizId} / CMID #{quiz.cmid}</div>
        </div>
      );
    case 'section':
      return quiz.sectionName;
    case 'visible':
      return quiz.visible ? 'Visible' : 'Masque';
    case 'openAt':
      return formatDateTime(quiz.openAt);
    case 'closeAt':
      return formatDateTime(quiz.closeAt);
    case 'duration':
      return formatDuration(quiz.durationSeconds);
    case 'questionCount':
      return quiz.questionCount ?? 'Indisponible';
    case 'questionExamples':
      return quiz.questionExamples.length > 0 ? quiz.questionExamples.join(' | ') : 'Aucun exemple';
    case 'previewSource':
      return formatPreviewSource(quiz);
    case 'description':
      return quiz.description || 'Indisponible';
    case 'questionTypes':
      return quiz.requiredQuestionTypes.length > 0 ? quiz.requiredQuestionTypes.join(', ') : 'Indisponible';
    case 'accessRules':
      return quiz.accessRules.length > 0 ? quiz.accessRules.join(' | ') : 'Aucune';
    case 'preventAccessReasons':
      return quiz.preventAccessReasons.length > 0 ? quiz.preventAccessReasons.join(' | ') : 'Aucune';
    case 'questionBankStatus':
      return 'Questions preview disponibles, categories encore indisponibles sans core_question_*';
    case 'groupOverrides':
      return 'Indisponible via les WS Moodle actuellement exposes';
    case 'url':
      return quiz.url ? (
        <a href={quiz.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700">
          Ouvrir
        </a>
      ) : 'Indisponible';
    default:
      return '';
  }
}

function CourseQuizzesCards({ quizzes }: { quizzes: CourseQuizSummary[] }) {
  return (
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
                    quiz.visible ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {quiz.visible ? 'visible' : 'masque'}
                </span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">{quiz.name}</h2>
              <p className="mt-2 text-sm text-gray-500">Quiz #{quiz.quizId} • CMID #{quiz.cmid}</p>
            </div>

            {quiz.url ? (
              <a href={quiz.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:text-blue-700">
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
              <p className="mt-1 text-sm text-gray-600">{quiz.description || 'Indisponible via les WS Moodle actuellement exposes'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Nombre de questions</p>
              <p className="mt-1 text-sm text-gray-600">{quiz.questionCount ?? 'Indisponible via les WS Moodle actuellement exposes'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Types de questions</p>
              <p className="mt-1 text-sm text-gray-600">
                {quiz.requiredQuestionTypes.length > 0
                  ? quiz.requiredQuestionTypes.join(', ')
                  : 'Indisponible via les WS Moodle actuellement exposes'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Derogations de groupe</p>
              <p className="mt-1 text-sm text-gray-600">Indisponible via les WS Moodle actuellement exposes</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Banque de questions</p>
              <p className="mt-1 text-sm text-gray-600">
                Questions preview disponibles, categories encore indisponibles sans core_question_*
              </p>
            </div>
          </div>

          {quiz.accessRules.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-medium text-gray-700">Regles d&apos;acces</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-gray-600">
                {quiz.accessRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>
          )}

          {quiz.preventAccessReasons.length > 0 && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-800">Restriction actuelle</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-amber-700">
                {quiz.preventAccessReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Exemples de questions</p>
                <p className="mt-1 text-xs text-gray-500">Source: {formatPreviewSource(quiz)}</p>
              </div>
            </div>

            {quiz.questionExamples.length > 0 ? (
              <ul className="mt-3 list-disc pl-5 text-sm text-gray-700">
                {quiz.questionExamples.map((example) => (
                  <li key={example}>{example}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-gray-600">Aucun exemple de question disponible pour le moment.</p>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

export function CourseQuizzesResults({
  course,
  groups,
  quizzes,
  dataLimitations,
}: CourseQuizzesResultsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(new Set(DEFAULT_COLUMNS));

  const toggleColumn = (columnKey: ColumnKey) => {
    setVisibleColumns((previous) => {
      const next = new Set(previous);
      if (next.has(columnKey)) {
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return next;
    });
  };

  const activeColumns = ALL_COLUMNS.filter((column) => visibleColumns.has(column.key));

  return (
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
                <p className="mt-1 text-sm text-gray-500">{group.description || 'Aucune description'}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Aucun groupe trouve pour ce cours.</p>
        )}
      </Card>

      <Card className="mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Affichage des examens</h2>
            <p className="mt-1 text-sm text-gray-500">Choisissez entre la vue detaillee par cartes et la vue contractee en tableau.</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'cards' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('cards')}
            >
              Cartes
            </Button>
            <Button
              variant={viewMode === 'table' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('table')}
            >
              Tableau
            </Button>
          </div>
        </div>

        {viewMode === 'table' && (
          <div className="mt-5">
            <p className="mb-3 text-sm font-medium text-gray-700">Colonnes affichees</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {ALL_COLUMNS.map((column) => (
                <Checkbox
                  key={column.key}
                  checked={visibleColumns.has(column.key)}
                  onChange={() => toggleColumn(column.key)}
                  label={column.label}
                />
              ))}
            </div>
          </div>
        )}
      </Card>

      {viewMode === 'cards' ? (
        <CourseQuizzesCards quizzes={quizzes} />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {activeColumns.map((column) => (
                    <th
                      key={column.key}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {quizzes.map((quiz) => (
                  <tr key={quiz.cmid} className="align-top">
                    {activeColumns.map((column) => (
                      <td key={`${quiz.cmid}-${column.key}`} className="px-4 py-4 text-sm text-gray-700">
                        {renderTableCell(column.key, quiz)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {quizzes.length === 0 && (
        <Card className="mt-6">
          <p className="text-gray-500">Aucun quiz trouve dans ce cours.</p>
        </Card>
      )}
    </>
  );
}
