'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import { learnersApi, parseCsv } from '@/services/data';
import { toast } from '@/stores/toastStore';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRow(r) {
  if (!r.firstName) return 'First name required';
  if (!r.lastName) return 'Last name required';
  if (!r.email) return 'Email required';
  if (!EMAIL_RE.test(r.email)) return 'Invalid email';
  return null;
}

function ManualEntry({ onDone }) {
  const blank = { firstName: '', lastName: '', email: '' };
  const [rows, setRows] = useState([{ ...blank }]);
  const [busy, setBusy] = useState(false);

  function update(i, field, val) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [field]: val } : r)));
  }

  async function submit() {
    const valid = rows.filter((r) => !validateRow(r));
    if (valid.length === 0) {
      toast.error('Fill in at least one valid row');
      return;
    }
    setBusy(true);
    try {
      const res = await learnersApi.createBatch(valid);
      toast.success(`Added ${res.created} learner(s)${res.failed ? `, ${res.failed} duplicate(s) skipped` : ''}`);
      onDone();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-3 gap-2">
            <input className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" placeholder="First name"
              value={r.firstName} onChange={(e) => update(i, 'firstName', e.target.value)} />
            <input className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" placeholder="Last name"
              value={r.lastName} onChange={(e) => update(i, 'lastName', e.target.value)} />
            <input className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" placeholder="Email"
              value={r.email} onChange={(e) => update(i, 'email', e.target.value)} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={() => setRows((rs) => [...rs, { ...blank }])}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100">
          + Add row
        </button>
        <button onClick={submit} disabled={busy}
          className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50">
          {busy ? 'Saving…' : 'Save learners'}
        </button>
      </div>
    </div>
  );
}

function CsvImport({ onDone }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result)).map((r) => ({ ...r, _error: validateRow(r) }));
      setRows(parsed);
    };
    reader.readAsText(file);
  }

  async function submit() {
    const valid = rows.filter((r) => !r._error).map(({ _error, ...r }) => r);
    if (valid.length === 0) {
      toast.error('No valid rows to import');
      return;
    }
    setBusy(true);
    try {
      const res = await learnersApi.createBatch(valid);
      toast.success(`Imported ${res.created} learner(s)${res.failed ? `, ${res.failed} duplicate(s) skipped` : ''}`);
      onDone();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const validCount = rows?.filter((r) => !r._error).length || 0;

  return (
    <div>
      <p className="mb-2 text-xs text-neutral-500">CSV header row: <code>firstName,lastName,email</code></p>
      <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-sm" />
      {rows && (
        <>
          <div className="mt-3 max-h-48 overflow-auto rounded-md border border-neutral-200">
            <table className="w-full text-xs">
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={r._error ? 'bg-amber-50' : ''}>
                    <td className="px-2 py-1">{r.firstName} {r.lastName}</td>
                    <td className="px-2 py-1 text-neutral-500">{r.email}</td>
                    <td className="px-2 py-1 text-amber-700">{r._error || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={submit} disabled={busy || validCount === 0}
            className="mt-3 rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50">
            {busy ? 'Importing…' : `Import ${validCount} valid row(s)`}
          </button>
        </>
      )}
    </div>
  );
}

function StudentsContent() {
  const [learners, setLearners] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [tab, setTab] = useState('manual');

  const load = useCallback(async (q) => {
    const res = await learnersApi.list({ search: q, limit: 50 });
    setLearners(res.learners);
    setTotal(res.total);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search), 250);
    return () => clearTimeout(t);
  }, [search, load]);

  function afterImport() {
    setImporting(false);
    load(search);
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Students</h1>
          <p className="mt-1 text-sm text-neutral-500">{total} learner{total === 1 ? '' : 's'}</p>
        </div>
        <button onClick={() => setImporting((v) => !v)}
          className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800">
          {importing ? 'Close' : 'Add students'}
        </button>
      </div>

      {importing && (
        <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-5">
          <div className="mb-3 flex gap-1 border-b border-neutral-200">
            {['manual', 'csv'].map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-sm ${tab === t ? 'border-b-2 border-teal-600 font-medium text-teal-700' : 'text-neutral-500'}`}>
                {t === 'manual' ? 'Manual entry' : 'CSV upload'}
              </button>
            ))}
          </div>
          {tab === 'manual' ? <ManualEntry onDone={afterImport} /> : <CsvImport onDone={afterImport} />}
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email…"
        className="mt-6 w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
      />

      <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">External ID</th>
            </tr>
          </thead>
          <tbody>
            {learners.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-neutral-400">No learners found</td></tr>
            ) : (
              learners.map((l) => (
                <tr key={l.id} className="border-t border-neutral-100">
                  <td className="px-4 py-2 text-neutral-800">{l.firstName} {l.lastName}</td>
                  <td className="px-4 py-2 text-neutral-500">{l.email}</td>
                  <td className="px-4 py-2 text-neutral-400">{l.externalId || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function StudentsPage() {
  return (
    <AppShell>
      <StudentsContent />
    </AppShell>
  );
}
