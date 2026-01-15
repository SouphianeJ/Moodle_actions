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
    title: 'Récupérer les feedback d\'un devoir',
    description: 'Récupérez tous les feedbacks des étudiants pour une évaluation donnée.',
    href: '/actions/assignment-feedback',
  },
  {
    id: 'student-submissions',
    title: 'Voir les rendus étudiants',
    description: 'Visualisez les fichiers soumis par les étudiants pour un ou plusieurs devoirs.',
    href: '/actions/student-submissions',
  },
];

export default function ActionsPage() {
  return (
    <AppShell>
      <PageHeader
        title="Actions"
        description="Choisissez une action à exécuter"
      />
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <Link key={action.id} href={action.href}>
            <Card className="h-full hover:border-blue-300 hover:shadow-md transition-all duration-200 cursor-pointer">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {action.title}
              </h3>
              <p className="text-gray-600 text-sm">
                {action.description}
              </p>
            </Card>
          </Link>
        ))}
      </div>
      
      {actions.length === 0 && (
        <Card className="text-center py-12">
          <p className="text-gray-500">
            Aucune action disponible pour le moment.
          </p>
        </Card>
      )}
    </AppShell>
  );
}
