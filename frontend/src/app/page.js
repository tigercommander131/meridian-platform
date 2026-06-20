'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/services/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(auth.isAuthenticated() ? '/dashboard' : '/login');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
      Redirecting…
    </div>
  );
}
