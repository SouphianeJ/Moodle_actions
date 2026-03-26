import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth/requireAuth';
import { getCourseQuizzesOverview } from '@/lib/moodle/courseQuizzesService';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) {
    return authResult;
  }

  const courseIdParam = request.nextUrl.searchParams.get('courseId');

  if (!courseIdParam) {
    return NextResponse.json(
      { error: "Le parametre 'courseId' est requis." },
      { status: 400 }
    );
  }

  const courseId = Number.parseInt(courseIdParam, 10);

  if (!Number.isInteger(courseId) || courseId <= 0) {
    return NextResponse.json(
      { error: "Le parametre 'courseId' doit etre un nombre entier positif." },
      { status: 400 }
    );
  }

  try {
    const result = await getCourseQuizzesOverview(courseId);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || 'Une erreur est survenue.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      ...result.data,
    });
  } catch (error) {
    console.error('[API/course-quizzes] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Une erreur inattendue est survenue.' },
      { status: 500 }
    );
  }
}
