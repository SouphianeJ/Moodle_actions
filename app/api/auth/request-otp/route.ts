import { NextResponse } from 'next/server';
import { createOtp, checkRateLimit } from '@/lib/auth/otp';
import { sendOtpEmail } from '@/lib/email/mailer';

const ALLOWED_EMAILS = (process.env.AUTH_ALLOWED_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email requis' },
        { status: 400 }
      );
    }
    
    // Check if email is allowed
    if (!ALLOWED_EMAILS.includes(email)) {
      // Don't reveal if email is not allowed - use generic message
      return NextResponse.json(
        { error: 'Une erreur est survenue. Veuillez réessayer.' },
        { status: 400 }
      );
    }
    
    // Check rate limit
    const withinLimit = await checkRateLimit(email);
    if (!withinLimit) {
      return NextResponse.json(
        { error: 'Trop de demandes. Veuillez patienter quelques minutes.' },
        { status: 429 }
      );
    }
    
    // Generate and store OTP
    const otp = await createOtp(email);
    
    // Send OTP via email
    await sendOtpEmail(email, otp);
    
    return NextResponse.json({
      success: true,
      message: 'Code envoyé par email',
    });
  } catch (error) {
    console.error('Error in request-otp:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue. Veuillez réessayer.' },
      { status: 500 }
    );
  }
}
