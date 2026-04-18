import { NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth/requireAuth';
import { executeApprovedExamPlan } from '@/lib/exam-request/runtime';
import { getExamRequestSession, insertExamRequestRun, recordExamRequestEvent } from '@/lib/exam-request/store';

export async function POST(
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

  if (data.state.approval.status !== 'approved') {
    return NextResponse.json({ error: 'The exam plan must be approved before execution.' }, { status: 400 });
  }

  if (!data.state.lastValidatedPlan) {
    return NextResponse.json({ error: 'No validated plan is available for execution.' }, { status: 400 });
  }

  const result = await executeApprovedExamPlan(requestId, data.state.lastValidatedPlan);
  await insertExamRequestRun({
    requestId,
    status: result.ok ? 'success' : 'failed',
    response: result.json ?? { status: result.status, body: result.text },
  });
  await recordExamRequestEvent(requestId, 'execution_http_result', {
    ok: result.ok,
    status: result.status,
  });

  return NextResponse.json({
    success: result.ok,
    response: result.json ?? { status: result.status, body: result.text },
  }, { status: result.ok ? 200 : 502 });
}
