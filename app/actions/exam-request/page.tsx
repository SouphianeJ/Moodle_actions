'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout';
import { Alert, Button, Card, Input, PageHeader } from '@/components/ui';

type ExamRequestMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  kind?: 'trace';
  title?: string;
  createdAt: string;
};

type ExamRequestSession = {
  id: string;
  title: string;
  messages: ExamRequestMessage[];
  createdAt: string;
  updatedAt: string;
};

type ExamRequestState = {
  requestId: string;
  runStatus: 'idle' | 'running' | 'failed';
  lastValidatedPlan: Record<string, unknown> | null;
  lastValidationResult: Record<string, unknown> | null;
  approval: {
    status: 'pending' | 'approved' | 'rejected' | 'not_requested';
    decidedAt?: string | null;
  };
  executionResult: Record<string, unknown> | null;
  lastProxyRequest: Record<string, unknown> | null;
  lastProxyResponse: Record<string, unknown> | null;
};

type SessionPayload = {
  session: ExamRequestSession;
  state: ExamRequestState;
};

type StreamEvent =
  | { type: 'trace'; title: string; content: string; status?: string }
  | { type: 'assistant_final'; content: string }
  | { type: 'plan_validated'; payload: Record<string, unknown> }
  | { type: 'error'; content: string }
  | { type: 'done' };

type UploadAttachment = {
  filename: string;
  format: 'aiken' | 'moodle_xml';
  base64Content: string;
  mimeType?: string;
};

function inferAttachmentFormat(file: File): UploadAttachment['format'] | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (extension === 'xml') {
    return 'moodle_xml';
  }
  if (extension === 'txt' || extension === 'aiken') {
    return 'aiken';
  }
  return null;
}

async function fileToBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export default function ExamRequestPage() {
  const [requests, setRequests] = useState<ExamRequestSession[]>([]);
  const [activeId, setActiveId] = useState('');
  const [sessionPayload, setSessionPayload] = useState<SessionPayload | null>(null);
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<UploadAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ variant: 'info' | 'success' | 'warning' | 'error'; message: string } | null>(null);

  const createRequest = useCallback(async () => {
    const response = await fetch('/api/actions/exam-request/requests', { method: 'POST' });
    const payload = await response.json();
    const request = payload.request as ExamRequestSession;
    setRequests((current) => [request, ...current]);
    return request;
  }, []);

  const loadRequests = useCallback(async () => {
    const response = await fetch('/api/actions/exam-request/requests');
    const payload = await response.json();
    const nextRequests = Array.isArray(payload.requests) ? payload.requests as ExamRequestSession[] : [];
    setRequests(nextRequests);
    if (!activeId && nextRequests[0]) {
      setActiveId(nextRequests[0].id);
    }
    if (!nextRequests[0] && !loading) {
      const created = await createRequest();
      setActiveId(created.id);
    }
  }, [activeId, createRequest, loading]);

  const loadSession = useCallback(async (id: string) => {
    const response = await fetch(`/api/actions/exam-request/${id}`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Impossible de charger la demande.');
    }
    setSessionPayload(payload as SessionPayload);
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (!activeId) {
      return;
    }
    void loadSession(activeId);
  }, [activeId, loadSession]);

  const canExecute = useMemo(() => {
    return sessionPayload?.state.approval.status === 'approved' && Boolean(sessionPayload.state.lastValidatedPlan);
  }, [sessionPayload]);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || !activeId) {
      return;
    }

    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch('/api/actions/exam-request/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: activeId, message: trimmed, attachments }),
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
        throw new Error(payload.error || 'Impossible de lancer la planification.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          const eventPayload = JSON.parse(line) as StreamEvent;
          if (eventPayload.type === 'error') {
            setNotice({ variant: 'error', message: eventPayload.content });
          }
          if (eventPayload.type === 'plan_validated') {
            setNotice({ variant: 'success', message: 'Plan valide. Verifiez l apercu puis approuvez ou executez.' });
          }
        }
      }

      setMessage('');
      setAttachments([]);
      await loadRequests();
      await loadSession(activeId);
    } catch (error) {
      setNotice({
        variant: 'error',
        message: error instanceof Error ? error.message : 'Erreur inattendue pendant la planification.',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const nextAttachments: UploadAttachment[] = [];

    for (const file of files) {
      const format = inferAttachmentFormat(file);
      if (!format) {
        setNotice({ variant: 'warning', message: `Format non supporte pour ${file.name}. Utilisez .txt/.aiken ou .xml.` });
        continue;
      }

      nextAttachments.push({
        filename: file.name,
        format,
        base64Content: await fileToBase64(file),
        mimeType: file.type || undefined,
      });
    }

    setAttachments(nextAttachments);
    event.target.value = '';
  }

  async function handleApproval(decision: 'approved' | 'rejected') {
    if (!activeId) {
      return;
    }
    const response = await fetch(`/api/actions/exam-request/${activeId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setNotice({ variant: 'error', message: payload.error || 'Impossible d enregistrer la decision.' });
      return;
    }
    setNotice({ variant: decision === 'approved' ? 'success' : 'warning', message: `Plan ${decision === 'approved' ? 'approuve' : 'rejete'}.` });
    await loadSession(activeId);
  }

  async function handleExecute() {
    if (!activeId) {
      return;
    }
    setLoading(true);
    const response = await fetch(`/api/actions/exam-request/${activeId}/execute`, { method: 'POST' });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setNotice({ variant: 'error', message: payload.error || 'Impossible d executer le plan.' });
      return;
    }
    setNotice({ variant: 'success', message: 'Execution terminee. Consultez le journal et la reponse proxy.' });
    await loadSession(activeId);
  }

  return (
    <AppShell>
      <PageHeader
        title="Exam builder MCP"
        description="Redigez une demande naturelle, obtenez un exam-plan valide, approuvez-le puis executez la creation dans Moodle."
      />

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Demandes</h2>
            <Button size="sm" onClick={() => void createRequest().then((request) => setActiveId(request.id))}>
              Nouvelle
            </Button>
          </div>
          <div className="space-y-2">
            {requests.map((request) => (
              <button
                key={request.id}
                type="button"
                onClick={() => setActiveId(request.id)}
                className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                  request.id === activeId ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="text-sm font-medium text-gray-900">{request.title}</div>
                <div className="mt-1 text-xs text-gray-500">{new Date(request.updatedAt).toLocaleString()}</div>
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <form onSubmit={handleSend} className="space-y-4">
              <Input
                type="text"
                label="Demande en langage naturel"
                placeholder="Cree un partiel dans STAPS_EDITABLE, ouverture lundi 9h, fermeture lundi 11h, 20 points, utilise le fichier XML joint."
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                helper="Le runtime prepare un exam-plan JSON, le valide via MCP, puis laisse l execution en attente d approbation."
              />
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700" htmlFor="exam-import-files">
                  Imports de questions
                </label>
                <input
                  id="exam-import-files"
                  type="file"
                  accept=".txt,.aiken,.xml,text/plain,text/xml,application/xml"
                  multiple
                  onChange={(event) => void handleFileSelection(event)}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
                />
                <div className="text-xs text-gray-500">
                  Fichiers acceptes: Aiken (.txt, .aiken) et Moodle XML (.xml).
                </div>
                {attachments.length > 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {attachments.map((attachment) => `${attachment.filename} (${attachment.format})`).join(' | ')}
                  </div>
                ) : null}
              </div>
              <Button type="submit" loading={loading} disabled={!activeId || !message.trim()}>
                Generer un plan
              </Button>
            </form>
          </Card>

          {notice && <Alert variant={notice.variant}>{notice.message}</Alert>}

          <Card className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => void handleApproval('approved')} disabled={!sessionPayload?.state.lastValidatedPlan}>
                Approuver
              </Button>
              <Button variant="ghost" onClick={() => void handleApproval('rejected')} disabled={!sessionPayload?.state.lastValidatedPlan}>
                Rejeter
              </Button>
              <Button onClick={() => void handleExecute()} disabled={!canExecute || loading} loading={loading}>
                Executer le plan
              </Button>
            </div>
            <div className="text-sm text-gray-600">
              Statut run: <span className="font-medium text-gray-900">{sessionPayload?.state.runStatus ?? 'idle'}</span>
              {' | '}
              Approbation: <span className="font-medium text-gray-900">{sessionPayload?.state.approval.status ?? 'not_requested'}</span>
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Historique</h2>
            <div className="space-y-3">
              {sessionPayload?.session.messages.length ? sessionPayload.session.messages.map((item) => (
                <div key={item.id} className={`rounded-lg border px-4 py-3 ${item.role === 'user' ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {item.role === 'user' ? 'Demande' : item.title || 'Assistant'}
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-sm text-gray-800">{item.content}</pre>
                </div>
              )) : (
                <div className="text-sm text-gray-500">Aucun message pour cette demande.</div>
              )}
            </div>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Execution Preview</h2>
              <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-gray-950 p-4 text-xs text-gray-100">
                {JSON.stringify(sessionPayload?.state.lastValidationResult ?? null, null, 2)}
              </pre>
            </Card>
            <Card className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Debug Proxy / Execution</h2>
              <div className="space-y-3">
                <div>
                  <div className="mb-1 text-sm font-medium text-gray-700">Dernier payload MCP</div>
                  <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-gray-100 p-3 text-xs text-gray-800">
                    {JSON.stringify(sessionPayload?.state.lastProxyRequest ?? null, null, 2)}
                  </pre>
                </div>
                <div>
                  <div className="mb-1 text-sm font-medium text-gray-700">Derniere reponse MCP</div>
                  <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-gray-100 p-3 text-xs text-gray-800">
                    {JSON.stringify(sessionPayload?.state.lastProxyResponse ?? sessionPayload?.state.executionResult ?? null, null, 2)}
                  </pre>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
