import { NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth/requireAuth';
import { streamExamPlanningRun, type ExamImportAttachment } from '@/lib/exam-request/runtime';
import { patchExamRequestState, recordExamRequestEvent } from '@/lib/exam-request/store';

type Body = {
  requestId?: unknown;
  message?: unknown;
  attachments?: unknown;
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) {
    return authResult;
  }

  const body = (await request.json()) as Body;
  const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const attachments = Array.isArray(body.attachments)
    ? body.attachments.flatMap((item) => {
        if (!item || typeof item !== 'object') {
          return [];
        }
        const attachment = item as Record<string, unknown>;
        const filename = typeof attachment.filename === 'string' ? attachment.filename.trim() : '';
        const format = attachment.format === 'moodle_xml' ? 'moodle_xml' : attachment.format === 'aiken' ? 'aiken' : '';
        const base64Content = typeof attachment.base64Content === 'string' ? attachment.base64Content.trim() : '';
        const mimeType = typeof attachment.mimeType === 'string' ? attachment.mimeType.trim() : undefined;
        if (!filename || !format || !base64Content) {
          return [];
        }
        return [{ filename, format, base64Content, mimeType }] satisfies ExamImportAttachment[];
      })
    : [];

  if (!requestId || !message) {
    return NextResponse.json({ error: 'requestId and message are required.' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const chunks: string[] = [];

  try {
    await streamExamPlanningRun(requestId, message, attachments, async (chunk) => {
      chunks.push(chunk);
    });
  } catch (error) {
    const content = error instanceof Error ? error.message : 'Unexpected exam planning error.';
    await patchExamRequestState(requestId, { runStatus: 'failed' });
    await recordExamRequestEvent(requestId, 'planner_error', { content });
    chunks.push(`${JSON.stringify({ type: 'error', content })}\n`);
  }

  return new Response(encoder.encode(chunks.join('')), {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
