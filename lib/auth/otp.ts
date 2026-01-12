import { createHash, randomInt } from 'crypto';
import { getCollection } from '@/lib/db/mongo';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MINUTES = 15;
const MAX_OTP_REQUESTS_PER_WINDOW = 5;

interface OTPDocument {
  email: string;
  hashedOtp: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
}

interface RateLimitDocument {
  email: string;
  count: number;
  windowStart: Date;
  expiresAt: Date;
}

function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex');
}

export function generateOtp(): string {
  const min = Math.pow(10, OTP_LENGTH - 1);
  const max = Math.pow(10, OTP_LENGTH) - 1;
  return randomInt(min, max + 1).toString();
}

export async function checkRateLimit(email: string): Promise<boolean> {
  const collection = await getCollection<RateLimitDocument>('rate_limits');
  const now = new Date();
  
  const record = await collection.findOne({ email });
  
  if (!record || record.windowStart < new Date(now.getTime() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000)) {
    // New window or expired window
    await collection.updateOne(
      { email },
      {
        $set: {
          count: 1,
          windowStart: now,
          expiresAt: new Date(now.getTime() + RATE_LIMIT_WINDOW_MINUTES * 60 * 1000),
        },
      },
      { upsert: true }
    );
    return true;
  }
  
  if (record.count >= MAX_OTP_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  await collection.updateOne(
    { email },
    { $inc: { count: 1 } }
  );
  
  return true;
}

export async function createOtp(email: string): Promise<string> {
  const collection = await getCollection<OTPDocument>('otps');
  
  // Delete any existing OTP for this email
  await collection.deleteMany({ email });
  
  const otp = generateOtp();
  const hashedOtp = hashOtp(otp);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);
  
  await collection.insertOne({
    email,
    hashedOtp,
    expiresAt,
    attempts: 0,
    createdAt: now,
  });
  
  return otp;
}

export async function verifyOtp(email: string, otp: string): Promise<{ valid: boolean; error?: string }> {
  const collection = await getCollection<OTPDocument>('otps');
  
  const record = await collection.findOne({ email });
  
  if (!record) {
    return { valid: false, error: 'Code invalide' };
  }
  
  // Check expiry
  if (record.expiresAt < new Date()) {
    await collection.deleteOne({ email });
    return { valid: false, error: 'Code invalide' };
  }
  
  // Check attempts
  if (record.attempts >= MAX_ATTEMPTS) {
    await collection.deleteOne({ email });
    return { valid: false, error: 'Code invalide' };
  }
  
  // Increment attempts
  await collection.updateOne(
    { email },
    { $inc: { attempts: 1 } }
  );
  
  // Verify OTP
  const hashedInput = hashOtp(otp);
  if (hashedInput !== record.hashedOtp) {
    return { valid: false, error: 'Code invalide' };
  }
  
  // Delete OTP after successful verification
  await collection.deleteOne({ email });
  
  return { valid: true };
}

export async function ensureIndexes(): Promise<void> {
  const otpCollection = await getCollection<OTPDocument>('otps');
  const rateLimitCollection = await getCollection<RateLimitDocument>('rate_limits');
  
  // TTL index for automatic cleanup
  await otpCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await rateLimitCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  
  // Unique index on email
  await otpCollection.createIndex({ email: 1 }, { unique: true });
  await rateLimitCollection.createIndex({ email: 1 }, { unique: true });
}
