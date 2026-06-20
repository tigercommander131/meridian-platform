'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import { usersApi } from '@/services/data';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/stores/toastStore';

const ROLE_OPTIONS = ['admin', 'educator', 'instructor', 'observer'];

function RolePills({ roles }) {
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <span key={r} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600">{r}</span>
      ))}
    </div>
  );
}

function UsersContent() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin');
  const [users, setUsers] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', roles: ['educator'] });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setUsers((await usersApi.list()).users); }
    catch (e) { toast.error(e.message); }
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  if (!isAdmin) {
    return <p className="text-sm text-amber-700">You need an admin role to manage users.</p>;
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  function toggleRole(r) {
    setForm((f) => ({ ...f, roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r] }));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await usersApi.create(form);
      toast.success('User added');
      setForm({ firstName: '', lastName: '', email: '', password: '', roles: ['educator'] });
      setAdding(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Team</h1>
          <p className="mt-1 text-sm text-neutral-500">Staff accounts in your organisation.</p>
        </div>
        <button onClick={() => setAdding((v) => !v)}
          className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800">
          {adding ? 'Cancel' : 'Add user'}
        </button>
      </div>

      {adding && (
        <form onSubmit={submit} className="mt-4 rounded-xl border border-neutral-200 bg-white p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input required value={form.firstName} onChange={set('firstName')} placeholder="First name"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            <input required value={form.lastName} onChange={set('lastName')} placeholder="Last name"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            <input required type="email" value={form.email} onChange={set('email')} placeholder="Email"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            <input required type="password" value={form.password} onChange={set('password')} placeholder="Temp password (min 8)"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-xs text-neutral-500">Roles:</span>
            {ROLE_OPTIONS.map((r) => (
              <label key={r} className="flex items-center gap-1.5 text-sm text-neutral-700">
                <input type="checkbox" checked={form.roles.includes(r)} onChange={() => toggleRole(r)}
                  className="rounded border-neutral-300 text-teal-700 focus:ring-teal-600" />
                {r}
              </label>
            ))}
          </div>
          <button type="submit" disabled={busy}
            className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50">
            {busy ? 'Adding…' : 'Create user'}
          </button>
        </form>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Roles</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-neutral-100">
                <td className="px-4 py-2.5 text-neutral-800">
                  {u.firstName} {u.lastName}
                  {u.id === user.id && <span className="ml-2 text-[11px] text-teal-700">you</span>}
                </td>
                <td className="px-4 py-2.5 text-neutral-500">{u.email}</td>
                <td className="px-4 py-2.5"><RolePills roles={u.roles} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
