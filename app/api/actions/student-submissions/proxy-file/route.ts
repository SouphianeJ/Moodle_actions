import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth/requireAuth';
import { getMoodleToken } from '@/lib/moodle/client';

/**
 * List of MIME types that can be previewed in the browser.
 * For these types, we force Content-Disposition: inline to display in iframe/img.
 */
const PREVIEWABLE_TYPES = [
  'application/pdf',
  'application/json',
  'text/',  // All text types (text/plain, text/html, text/csv, etc.)
  'image/', // All image types (image/png, image/jpeg, image/gif, etc.)
];

/**
 * Check if a MIME type is previewable in the browser.
 */
function isPreviewable(contentType: string): boolean {
  const lowerType = contentType.toLowerCase().split(';')[0].trim();
  return PREVIEWABLE_TYPES.some(type => lowerType.startsWith(type));
}

/**
 * Extract filename from Content-Disposition header.
 * Handles both filename="..." and filename*=UTF-8''... formats.
 */
function extractFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;
  
  // Try filename*= format first (RFC 5987)
  const filenameStarMatch = contentDisposition.match(/filename\*=(?:UTF-8''|utf-8'')([^;]+)/i);
  if (filenameStarMatch) {
    try {
      return decodeURIComponent(filenameStarMatch[1]);
    } catch {
      // Fall through to regular filename
    }
  }
  
  // Try regular filename= format
  const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (filenameMatch) {
    return filenameMatch[1].trim();
  }
  
  return null;
}

/**
 * GET /api/actions/student-submissions/proxy-file
 * 
 * Proxies a file from Moodle to avoid exposing the token to the client.
 * Streams the file content directly to the client.
 * Requires authentication (JWT).
 * 
 * For previewable files (PDF, images, text), forces Content-Disposition: inline
 * to enable in-browser display in iframes and img tags.
 * 
 * Supports HTTP Range requests for PDF viewers.
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

    // Build headers to forward to Moodle, including Range for PDF support
    const fetchHeaders: Record<string, string> = {
      'Accept': '*/*',
    };
    
    // Forward Range header if present (for PDF viewers)
    const rangeHeader = request.headers.get('Range');
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }

    // Fetch the file from Moodle
    const response = await fetch(url.toString(), {
      headers: fetchHeaders,
    });

    if (!response.ok && response.status !== 206) {
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
    const contentRange = response.headers.get('Content-Range');
    const acceptRanges = response.headers.get('Accept-Ranges');

    // Extract filename for Content-Disposition header
    const filename = extractFilename(contentDisposition);

    // Build response headers
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    };

    // Set Content-Disposition based on whether the file is previewable
    if (isPreviewable(contentType)) {
      // Force inline for previewable files to display in iframe/img
      if (filename) {
        headers['Content-Disposition'] = `inline; filename="${filename}"`;
      } else {
        headers['Content-Disposition'] = 'inline';
      }
    } else if (contentDisposition) {
      // Keep original disposition for non-previewable files
      headers['Content-Disposition'] = contentDisposition;
    }

    if (contentLength) {
      headers['Content-Length'] = contentLength;
    }

    // Forward Range-related headers for PDF support
    if (contentRange) {
      headers['Content-Range'] = contentRange;
    }
    
    if (acceptRanges) {
      headers['Accept-Ranges'] = acceptRanges;
    } else {
      // Indicate that we support range requests
      headers['Accept-Ranges'] = 'bytes';
    }

    // Return the streamed response with appropriate status (200 or 206)
    return new Response(response.body, {
      status: response.status,
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
