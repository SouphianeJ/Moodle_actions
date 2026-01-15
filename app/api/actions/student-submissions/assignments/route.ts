import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth/requireAuth';
import { listCourseAssignments } from '@/lib/moodle/studentSubmissionsService';

/**
 * GET /api/actions/student-submissions/assignments
 * 
 * Lists all assignments for a given course.
 * Requires authentication (JWT).
 * 
 * Query parameters:
 * - courseId: The course ID (required, numeric)
 */
export async function GET(request: NextRequest) {
  // Verify authentication
  const authResult = await requireAuth();
  if (isAuthError(authResult)) {
    return authResult;
  }

  // Get and validate courseId parameter
  const searchParams = request.nextUrl.searchParams;
  const courseIdParam = searchParams.get('courseId');

  if (!courseIdParam) {
    return NextResponse.json(
      { error: "Le paramètre 'courseId' est requis." },
      { status: 400 }
    );
  }

  const courseId = parseInt(courseIdParam, 10);

  if (isNaN(courseId) || courseId <= 0) {
    return NextResponse.json(
      { error: "Le paramètre 'courseId' doit être un nombre entier positif." },
      { status: 400 }
    );
  }

  try {
    const result = await listCourseAssignments(courseId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Une erreur est survenue.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      assignments: result.data,
    });
  } catch (error) {
    console.error('[API/student-submissions/assignments] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Une erreur inattendue est survenue.' },
      { status: 500 }
    );
  }
}
