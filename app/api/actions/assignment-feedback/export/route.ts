import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth/requireAuth';
import { exportAssignmentFeedback } from '@/lib/moodle/assignmentFeedbackExporter';
import { generateCsv, createCsvResponse } from '@/lib/export/csv';

/**
 * GET /api/actions/assignment-feedback/export
 * 
 * Exports assignment feedback as a CSV file.
 * Requires authentication (JWT).
 * 
 * Query parameters:
 * - cmid: The course module ID (required, numeric)
 */
export async function GET(request: NextRequest) {
  // Verify authentication
  const authResult = await requireAuth();
  if (isAuthError(authResult)) {
    return authResult;
  }

  // Get and validate cmid parameter
  const searchParams = request.nextUrl.searchParams;
  const cmidParam = searchParams.get('cmid');

  if (!cmidParam) {
    return NextResponse.json(
      { error: "Le paramètre 'cmid' est requis." },
      { status: 400 }
    );
  }

  const cmid = parseInt(cmidParam, 10);

  if (isNaN(cmid) || cmid <= 0) {
    return NextResponse.json(
      { error: "Le paramètre 'cmid' doit être un nombre entier positif." },
      { status: 400 }
    );
  }

  try {
    // Execute the export
    const result = await exportAssignmentFeedback(cmid);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Une erreur est survenue lors de l\'export.' },
        { status: 400 }
      );
    }

    // Generate CSV content
    const headers = ['Nom', 'Prenom', 'Note', 'Feedback'];
    const rows = (result.data || []).map(student => [
      student.lastName,
      student.firstName,
      student.grade,
      student.feedback,
    ]);

    const csvContent = generateCsv(headers, rows);

    // Generate filename with date
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `assignment-feedback-${cmid}-${dateStr}.csv`;

    console.log(`[API/assignment-feedback/export] Export successful for cmid=${cmid}, stats:`, result.stats);

    return createCsvResponse(csvContent, filename);
  } catch (error) {
    console.error('[API/assignment-feedback/export] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Une erreur inattendue est survenue.' },
      { status: 500 }
    );
  }
}
