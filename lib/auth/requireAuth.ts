import { NextResponse } from 'next/server';
import { getCurrentUser } from './jwt';

interface AuthResult {
  email: string;
}

export async function requireAuth(): Promise<AuthResult | NextResponse> {
  const user = await getCurrentUser();
  
  if (!user) {
    return NextResponse.json(
      { error: 'Non authentifié' },
      { status: 401 }
    );
  }
  
  return { email: user.email };
}

export function isAuthError(result: AuthResult | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
