'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/services/api';
import AuthLayout, { Field } from '@/components/auth/AuthLayout';

export default function SignupPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [form, setForm] = useState({ organisationName: '', firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const { organisationName, firstName, lastName, email, password } = form;
    if (!organisationName || !firstName || !lastName || !email || !password) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await auth.register(form);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="Set up your organisation and admin account"
      footer={<>Already have an account? <Link href="/login" className="font-medium text-[var(--accent-ink)] hover:underline">Sign in</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Organisation" value={form.organisationName} onChange={set('organisationName')}
          placeholder="e.g. Riverside Ambulance Training" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" value={form.firstName} onChange={set('firstName')} placeholder="Ada" autoComplete="given-name" />
          <Field label="Last name" value={form.lastName} onChange={set('lastName')} placeholder="Lovelace" autoComplete="family-name" />
        </div>
        <Field label="Email" type="email" value={form.email} onChange={set('email')}
          placeholder="you@organisation.edu" autoComplete="email" />
        <Field label="Password" hint="min 8 characters" type="password" value={form.password} onChange={set('password')}
          placeholder="••••••••" autoComplete="new-password" />

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <button type="submit" disabled={loading}
          className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50">
          {loading ? 'Creating…' : 'Create account'}
        </button>
        <p className="text-center text-xs text-neutral-400">
          You'll be the admin and can invite your team afterwards.
        </p>
      </form>
    </AuthLayout>
  );
}
