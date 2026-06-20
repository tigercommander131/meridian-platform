'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthLayout, { Field, Link } from '@/components/auth/AuthLayout';
import { auth } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';

// Student self-registration: claim a learner account by the enrolled email.
export default function ClaimPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!email || !password) return setError('Email and password are required.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    setLoading(true);
    try {
      await auth.studentRegister(email, password);
      useAuthStore.getState().hydrate();
      router.push('/portal');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Set up your student login"
      subtitle="Use the email your trainer enrolled you with"
      footer={<>Already set up? <Link href="/login" className="font-medium text-teal-700 hover:underline">Sign in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
        <Field label="Create a password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-50">
          {loading ? 'Setting up…' : 'Create my login'}
        </button>
      </form>
    </AuthLayout>
  );
}
