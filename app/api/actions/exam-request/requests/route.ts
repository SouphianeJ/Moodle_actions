import { NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth/requireAuth';
import { createExamRequestSession, listExamRequestSessions } from '@/lib/exam-request/store';

export async function GET() {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) {
    return authResult;
  }

  const requests = await listExamRequestSessions();
  return NextResponse.json({ requests });
}

export async function POST() {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) {
    return authResult;
  }

  const request = await createExamRequestSession();
  return NextResponse.json({ request }, { status: 201 });
}
