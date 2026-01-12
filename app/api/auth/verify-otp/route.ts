import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/auth/otp';
import { setAuthCookie } from '@/lib/auth/jwt';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();
    const otp = (body.otp || '').trim();
    
    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email et code requis' },
        { status: 400 }
      );
    }
    
    // Verify OTP
    const result = await verifyOtp(email, otp);
    
    if (!result.valid) {
      return NextResponse.json(
        { error: result.error || 'Code invalide' },
        { status: 400 }
      );
    }
    
    // Set auth cookie
    await setAuthCookie(email);
    
    return NextResponse.json({
      success: true,
      message: 'Connexion réussie',
    });
  } catch (error) {
    console.error('Error in verify-otp:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue. Veuillez réessayer.' },
      { status: 500 }
    );
  }
}
