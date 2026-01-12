'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Nav } from './Nav';
import { Container } from '@/components/ui';

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch {
      setLoggingOut(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <Container size="xl">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link
                href="/actions"
                className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
              >
                Moodle Actions
              </Link>
              <Nav />
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
            >
              {loggingOut ? 'Déconnexion...' : 'Déconnexion'}
            </button>
          </div>
        </Container>
      </header>
      <main className="py-8">
        <Container size="xl">
          {children}
        </Container>
      </main>
    </div>
  );
}
