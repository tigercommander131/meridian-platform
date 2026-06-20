'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import AuthLayout, { Field } from '@/components/auth/AuthLayout';

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, user, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const homeFor = (u) => (u?.kind === 'student' ? '/portal' : '/dashboard');

  // Already logged in → skip the form (route by account type).
  useEffect(() => {
    if (isAuthenticated) router.replace(homeFor(user));
  }, [isAuthenticated, user, router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      const u = await login(username, password);
      router.push(homeFor(u));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your training workspace"
      footer={
        <div className="space-y-1">
          <p>New organisation? <Link href="/signup" className="font-medium text-teal-700 hover:underline">Create an account</Link></p>
          <p>Student? <Link href="/claim" className="font-medium text-teal-700 hover:underline">Set up your student login</Link></p>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Email"
          type="email"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="you@organisation.edu"
          autoComplete="email"
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
        />

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  );
}
