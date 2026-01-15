import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth/requireAuth';
import { getStudentFiles, type AssignmentInfo } from '@/lib/moodle/studentSubmissionsService';

/**
 * POST /api/actions/student-submissions/files
 * 
 * Gets all submission files for a student across selected assignments.
 * Requires authentication (JWT).
 * 
 * Request body:
 * - userId: The user ID (required, numeric)
 * - assignments: Array of assignment objects with cmid, assignid, name (required)
 */
export async function POST(request: NextRequest) {
  // Verify authentication
  const authResult = await requireAuth();
  if (isAuthError(authResult)) {
    return authResult;
  }

  try {
    const body = await request.json();
    
    const { userId, assignments } = body as {
      userId: number;
      assignments: AssignmentInfo[];
    };

    if (!userId || typeof userId !== 'number' || userId <= 0) {
      return NextResponse.json(
        { error: "Le paramètre 'userId' doit être un nombre entier positif." },
        { status: 400 }
      );
    }

    if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
      return NextResponse.json(
        { error: "Le paramètre 'assignments' est requis et doit être un tableau non vide." },
        { status: 400 }
      );
    }

    // Validate assignments structure
    for (const assignment of assignments) {
      if (!assignment.assignid || !assignment.cmid || !assignment.name) {
        return NextResponse.json(
          { error: "Chaque devoir doit avoir un assignid, cmid et name." },
          { status: 400 }
        );
      }
    }

    const result = await getStudentFiles(userId, assignments);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Une erreur est survenue.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('[API/student-submissions/files] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Une erreur inattendue est survenue.' },
      { status: 500 }
    );
  }
}
