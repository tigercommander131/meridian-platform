'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader, Button, Badge, Field, Input, Avatar } from '@/components/ui/kit';
import { usersApi } from '@/services/data';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/stores/toastStore';

const ROLE_OPTIONS = ['admin', 'organisation_admin', 'course_operations_manager', 'course_coordinator', 'educator', 'finance_user', 'observer'];

function UsersContent() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.some((r) => ['admin', 'organisation_admin'].includes(r));
  const [users, setUsers] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', roles: ['course_coordinator'] });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setUsers((await usersApi.list()).users); } catch (e) { toast.error(e.message); }
  }, []);
  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  if (!isAdmin) return <Card className="text-sm text-amber-700">You need an admin role to manage users.</Card>;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleRole = (r) => setForm((f) => ({ ...f, roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r] }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await usersApi.create(form);
      toast.success('User added');
      setForm({ firstName: '', lastName: '', email: '', password: '', roles: ['course_coordinator'] });
      setAdding(false); load();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Team" subtitle="Staff accounts in your organisation."
        action={<Button onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : 'Add user'}</Button>} />

      {adding && (
        <form onSubmit={submit} className="mt-5">
          <Card>
            <CardHeader title="New user" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="First name"><Input required value={form.firstName} onChange={set('firstName')} /></Field>
              <Field label="Last name"><Input required value={form.lastName} onChange={set('lastName')} /></Field>
              <Field label="Email"><Input required type="email" value={form.email} onChange={set('email')} /></Field>
              <Field label="Temp password" hint="min 8 chars"><Input required type="password" value={form.password} onChange={set('password')} /></Field>
            </div>
            <div className="mt-4">
              <p className="lbl">Roles</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                {ROLE_OPTIONS.map((r) => (
                  <label key={r} className="flex items-center gap-1.5 text-sm text-[var(--ink-2)]">
                    <input type="checkbox" checked={form.roles.includes(r)} onChange={() => toggleRole(r)} className="accent-teal-700" /> {r.replace(/_/g, ' ')}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={busy} className="mt-5">{busy ? 'Adding…' : 'Create user'}</Button>
          </Card>
        </form>
      )}

      <Card padded={false} className="mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-2)] text-left text-xs uppercase tracking-wide text-[var(--ink-3)]">
            <tr><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Email</th><th className="px-4 py-3 font-medium">Roles</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-[var(--line)] transition-colors hover:bg-neutral-50/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={`${u.firstName} ${u.lastName}`} className="h-7 w-7 text-[11px]" />
                    <span className="font-medium text-[var(--ink)]">{u.firstName} {u.lastName}</span>
                    {u.id === user.id && <span className="text-[11px] text-teal-700">you</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-[var(--ink-3)]">{u.email}</td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r}>{r.replace(/_/g, ' ')}</Badge>)}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

export default function UsersPage() {
  return (
    <AppShell>
      <UsersContent />
    </AppShell>
  );
}
