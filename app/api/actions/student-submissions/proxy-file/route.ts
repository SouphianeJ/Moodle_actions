import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth/requireAuth';
import { getMoodleToken } from '@/lib/moodle/client';

/**
 * GET /api/actions/student-submissions/proxy-file
 * 
 * Proxies a file from Moodle to avoid exposing the token to the client.
 * Streams the file content directly to the client.
 * Requires authentication (JWT).
 * 
 * Query parameters:
 * - url: The Moodle file URL (required)
 */
export async function GET(request: NextRequest) {
  // Verify authentication
  const authResult = await requireAuth();
  if (isAuthError(authResult)) {
    return authResult;
  }

  const searchParams = request.nextUrl.searchParams;
  const fileUrl = searchParams.get('url');

  if (!fileUrl) {
    return NextResponse.json(
      { error: "Le paramètre 'url' est requis." },
      { status: 400 }
    );
  }

  const token = getMoodleToken();
  if (!token) {
    return NextResponse.json(
      { error: 'Configuration Moodle incomplète.' },
      { status: 500 }
    );
  }

  try {
    // Add token to the URL
    const url = new URL(fileUrl);
    url.searchParams.set('token', token);

    // Fetch the file from Moodle
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': '*/*',
      },
    });

    if (!response.ok) {
      console.error(`[API/proxy-file] Moodle returned ${response.status} for ${fileUrl}`);
      return NextResponse.json(
        { error: `Impossible de récupérer le fichier (${response.status}).` },
        { status: response.status }
      );
    }

    // Get content type and filename from Moodle response
    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    const contentDisposition = response.headers.get('Content-Disposition');
    const contentLength = response.headers.get('Content-Length');

    // Stream the response
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    };

    if (contentDisposition) {
      headers['Content-Disposition'] = contentDisposition;
    }

    if (contentLength) {
      headers['Content-Length'] = contentLength;
    }

    // Return the streamed response
    return new Response(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('[API/proxy-file] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Une erreur inattendue est survenue.' },
      { status: 500 }
    );
  }
}
