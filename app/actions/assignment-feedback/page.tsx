'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout';
import { PageHeader, Card, Input, Button, Alert } from '@/components/ui';

type AlertState = {
  variant: 'info' | 'success' | 'warning' | 'error';
  message: string;
} | null;

export default function AssignmentFeedbackPage() {
  const [evaluationId, setEvaluationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);
  
  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cmid = evaluationId.trim();
    
    // Validate input is a positive integer
    if (!/^\d+$/.test(cmid) || parseInt(cmid, 10) <= 0) {
      setAlert({
        variant: 'error',
        message: "L'identifiant doit être un nombre entier positif.",
      });
      return;
    }
    
    setLoading(true);
    setAlert(null);
    
    try {
      const response = await fetch(`/api/actions/assignment-feedback/export?cmid=${cmid}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
        throw new Error(errorData.error || `Erreur ${response.status}`);
      }
      
      // Get the blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `assignment-feedback-${cmid}.csv`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) {
          filename = match[1];
        }
      }
      
      // Create temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setAlert({
        variant: 'success',
        message: 'Le téléchargement a démarré avec succès.',
      });
    } catch (error) {
      console.error('Download error:', error);
      setAlert({
        variant: 'error',
        message: error instanceof Error ? error.message : 'Impossible de générer l\'export. Vérifiez l\'identifiant.',
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <AppShell>
      <PageHeader
        title="Récupérer les feedback d'un devoir"
        description="Saisissez l'identifiant de l'évaluation pour récupérer les feedbacks des étudiants au format CSV."
      />
      
      <Card className="max-w-xl">
        <form onSubmit={handleDownload}>
          <Input
            type="text"
            label="ID de l'évaluation (cmid)"
            placeholder="Ex: 9267"
            value={evaluationId}
            onChange={(e) => setEvaluationId(e.target.value)}
            helper="Le cmid se trouve dans l'URL Moodle de l'évaluation (paramètre 'id' de la page du devoir)."
          />
          
          <Button
            type="submit"
            className="mt-4"
            disabled={!evaluationId.trim() || loading}
            loading={loading}
          >
            {loading ? 'Génération en cours...' : 'Télécharger CSV'}
          </Button>
        </form>
        
        {alert && (
          <Alert variant={alert.variant} className="mt-6">
            {alert.message}
          </Alert>
        )}
      </Card>
    </AppShell>
  );
}
