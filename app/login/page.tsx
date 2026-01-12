'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, Container, Alert } from '@/components/ui';

type Step = 'email' | 'otp';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || 'Une erreur est survenue');
        return;
      }
      
      setStep('otp');
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || 'Une erreur est survenue');
        return;
      }
      
      router.push('/actions');
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleBack = () => {
    setStep('email');
    setOtp('');
    setError('');
  };
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <Container size="sm">
        <Card className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">
              Moodle Actions
            </h1>
            <p className="mt-2 text-gray-600">
              {step === 'email'
                ? 'Connectez-vous pour accéder à vos actions'
                : 'Entrez le code reçu par email'
              }
            </p>
          </div>
          
          {error && (
            <Alert variant="error" className="mb-6">
              {error}
            </Alert>
          )}
          
          {step === 'email' ? (
            <form onSubmit={handleRequestOtp}>
              <Input
                type="email"
                label="Adresse email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoFocus
              />
              <Button
                type="submit"
                className="w-full mt-4"
                loading={loading}
                disabled={!email.trim()}
              >
                Continuer
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp}>
              <Input
                type="text"
                label="Code de vérification"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                disabled={loading}
                autoFocus
                maxLength={6}
                pattern="[0-9]*"
                inputMode="numeric"
                helper={`Code envoyé à ${email}`}
              />
              <Button
                type="submit"
                className="w-full mt-4"
                loading={loading}
                disabled={otp.length !== 6}
              >
                Se connecter
              </Button>
              <button
                type="button"
                onClick={handleBack}
                disabled={loading}
                className="w-full mt-3 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Modifier l&apos;email
              </button>
            </form>
          )}
        </Card>
      </Container>
    </div>
  );
}
