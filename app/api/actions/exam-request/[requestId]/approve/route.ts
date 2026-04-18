import { NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth/requireAuth';
import { approveExamPlan } from '@/lib/exam-request/runtime';
import { insertExamRequestApproval } from '@/lib/exam-request/store';

type Body = {
  decision?: unknown;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { requestId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Body;
  const decision = body.decision === 'rejected' ? 'rejected' : 'approved';
  const state = await approveExamPlan(requestId, decision);
  await insertExamRequestApproval({ requestId, decision, state });
  return NextResponse.json({ success: true, state });
}
