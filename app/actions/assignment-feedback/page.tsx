'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout';
import { PageHeader, Card, Input, Button, Alert } from '@/components/ui';

export default function AssignmentFeedbackPage() {
  const [evaluationId, setEvaluationId] = useState('');
  const [message, setMessage] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement Moodle API call
    setMessage('Fonctionnalité en cours de développement. L\'ID saisi est : ' + evaluationId);
  };
  
  return (
    <AppShell>
      <PageHeader
        title="Récupérer les feedback d'un devoir"
        description="Saisissez l'identifiant de l'évaluation pour récupérer les feedbacks des étudiants."
      />
      
      <Card className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <Input
            type="text"
            label="ID de l'évaluation"
            placeholder="Entrez l'identifiant de l'évaluation"
            value={evaluationId}
            onChange={(e) => setEvaluationId(e.target.value)}
            helper="L'identifiant se trouve dans l'URL de l'évaluation Moodle"
          />
          
          <Button
            type="submit"
            className="mt-4"
            disabled={!evaluationId.trim()}
          >
            Continuer
          </Button>
        </form>
        
        {message && (
          <Alert variant="info" className="mt-6">
            {message}
          </Alert>
        )}
      </Card>
    </AppShell>
  );
}
