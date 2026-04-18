import { NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth/requireAuth';
import { getExamRequestSession, listExamRequestEvents } from '@/lib/exam-request/store';

export async function GET(
  _request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { requestId } = await context.params;
  const data = await getExamRequestSession(requestId);
  if (!data) {
    return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
  }

  const events = await listExamRequestEvents(requestId);
  return NextResponse.json({ ...data, events });
}
