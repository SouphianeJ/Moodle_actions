import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'auth_token';

// Routes that don't require authentication
const publicRoutes = [
  '/login',
  '/api/auth/request-otp',
  '/api/auth/verify-otp',
];

// Static assets and Next.js internal routes to ignore
const ignoredPaths = [
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((route) => pathname === route || pathname.startsWith(route + '/'));
}

function isIgnoredPath(pathname: string): boolean {
  return ignoredPaths.some((path) => pathname.startsWith(path));
}

async function verifyJWT(token: string): Promise<boolean> {
  if (!JWT_SECRET) return false;
  
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for ignored paths
  if (isIgnoredPath(pathname)) {
    return NextResponse.next();
  }
  
  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }
  
  // Check for auth token
  const token = request.cookies.get(COOKIE_NAME)?.value;
  
  if (!token) {
    // Redirect to login for page requests
    if (!pathname.startsWith('/api/')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // Return 401 for API requests
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  // Verify token
  const isValid = await verifyJWT(token);
  
  if (!isValid) {
    // Clear invalid cookie and redirect/return error
    const response = !pathname.startsWith('/api/')
      ? NextResponse.redirect(new URL('/login', request.url))
      : NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    response.cookies.delete(COOKIE_NAME);
    return response;
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
