import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth/requireAuth';
import { getTeacherSyncPreviewSnapshot } from '@/lib/teacher-sync-preview/service';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) {
    return authResult;
  }

  const refreshParam = request.nextUrl.searchParams.get('refresh');
  const refresh = refreshParam === 'true' || refreshParam === '1';

  try {
    const result = await getTeacherSyncPreviewSnapshot({ refresh });

    return NextResponse.json({
      success: true,
      fromCache: result.fromCache,
      snapshot: result.snapshot,
    });
  } catch (error) {
    console.error('[API/teacher-sync-preview] Unexpected error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Une erreur inattendue est survenue lors de la génération du snapshot.',
      },
      { status: 500 },
    );
  }
}
