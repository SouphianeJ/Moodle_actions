import Link from 'next/link';
import { AppShell } from '@/components/layout';
import { PageHeader, Card } from '@/components/ui';

interface ActionItem {
  id: string;
  title: string;
  description: string;
  href: string;
}

const actions: ActionItem[] = [
  {
    id: 'assignment-feedback',
    title: 'Recuperer les feedback d\'un devoir',
    description: 'Recuperez tous les feedbacks des etudiants pour une evaluation donnee.',
    href: '/actions/assignment-feedback',
  },
  {
    id: 'student-submissions',
    title: 'Voir les rendus etudiants',
    description: 'Visualisez les fichiers soumis par les etudiants pour un ou plusieurs devoirs.',
    href: '/actions/student-submissions',
  },
  {
    id: 'teacher-sync-preview',
    title: 'Previsualiser la sync enseignants',
    description: 'Compare les enseignants Hyperplanning ILEPS avec leurs comptes et cours Moodle existants.',
    href: '/actions/teacher-sync-preview',
  },
];

export default function ActionsPage() {
  return (
    <AppShell>
      <PageHeader
        title="Actions"
        description="Choisissez une action a executer"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <Link key={action.id} href={action.href}>
            <Card className="h-full cursor-pointer transition-all duration-200 hover:border-blue-300 hover:shadow-md">
              <h3 className="mb-2 text-lg font-semibold text-gray-900">
                {action.title}
              </h3>
              <p className="text-sm text-gray-600">
                {action.description}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      {actions.length === 0 && (
        <Card className="py-12 text-center">
          <p className="text-gray-500">
            Aucune action disponible pour le moment.
          </p>
        </Card>
      )}
    </AppShell>
  );
}
