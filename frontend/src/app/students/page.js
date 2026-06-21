'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/ui/PageHeader';
import { Card, Button, Input, Tabs, Avatar } from '@/components/ui/kit';
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
  const update = (i, field, val) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [field]: val } : r)));

  async function submit() {
    const valid = rows.filter((r) => !validateRow(r));
    if (valid.length === 0) return toast.error('Fill in at least one valid row');
    setBusy(true);
    try {
      const res = await learnersApi.createBatch(valid);
      toast.success(`Added ${res.created} learner(s)${res.failed ? `, ${res.failed} duplicate(s) skipped` : ''}`);
      onDone();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="pt-4">
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-3 gap-2">
            <Input placeholder="First name" value={r.firstName} onChange={(e) => update(i, 'firstName', e.target.value)} />
            <Input placeholder="Last name" value={r.lastName} onChange={(e) => update(i, 'lastName', e.target.value)} />
            <Input placeholder="Email" value={r.email} onChange={(e) => update(i, 'email', e.target.value)} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" onClick={() => setRows((rs) => [...rs, { ...blank }])}>+ Add row</Button>
        <Button onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save learners'}</Button>
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
    reader.onload = () => setRows(parseCsv(String(reader.result)).map((r) => ({ ...r, _error: validateRow(r) })));
    reader.readAsText(file);
  }

  async function submit() {
    const valid = rows.filter((r) => !r._error).map(({ _error, ...r }) => r);
    if (valid.length === 0) return toast.error('No valid rows to import');
    setBusy(true);
    try {
      const res = await learnersApi.createBatch(valid);
      toast.success(`Imported ${res.created} learner(s)${res.failed ? `, ${res.failed} duplicate(s) skipped` : ''}`);
      onDone();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  const validCount = rows?.filter((r) => !r._error).length || 0;

  return (
    <div className="pt-4">
      <p className="mb-2 text-xs text-[var(--ink-3)]">CSV header row: <code className="rounded bg-[var(--surface-2)] px-1 py-0.5">firstName,lastName,email</code></p>
      <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-sm" />
      {rows && (
        <>
          <div className="mt-3 max-h-48 overflow-auto rounded-lg border border-[var(--line)]">
            <table className="w-full text-xs">
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={r._error ? 'bg-amber-50' : ''}>
                    <td className="px-2 py-1">{r.firstName} {r.lastName}</td>
                    <td className="px-2 py-1 text-[var(--ink-3)]">{r.email}</td>
                    <td className="px-2 py-1 text-amber-700">{r._error || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button onClick={submit} disabled={busy || validCount === 0} className="mt-3">{busy ? 'Importing…' : `Import ${validCount} valid row(s)`}</Button>
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
    setLearners(res.learners); setTotal(res.total);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search), 250);
    return () => clearTimeout(t);
  }, [search, load]);

  function afterImport() { setImporting(false); load(search); }

  return (
    <>
      <PageHeader title="Students" subtitle={`${total} learner${total === 1 ? '' : 's'} on record`}
        action={<Button onClick={() => setImporting((v) => !v)}>{importing ? 'Close' : 'Add students'}</Button>} />

      {importing && (
        <Card className="mt-5">
          <Tabs tabs={[{ value: 'manual', label: 'Manual entry' }, { value: 'csv', label: 'CSV upload' }]} active={tab} onChange={setTab} />
          {tab === 'manual' ? <ManualEntry onDone={afterImport} /> : <CsvImport onDone={afterImport} />}
        </Card>
      )}

      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email…" className="mt-6 max-w-sm" />

      <Card padded={false} className="mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-2)] text-left text-xs uppercase tracking-wide text-[var(--ink-3)]">
            <tr><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Email</th><th className="px-4 py-3 font-medium">External ID</th></tr>
          </thead>
          <tbody>
            {learners.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-10 text-center text-[var(--ink-3)]">No learners found</td></tr>
            ) : (
              learners.map((l) => (
                <tr key={l.id} className="border-t border-[var(--line)] transition-colors hover:bg-neutral-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={`${l.firstName} ${l.lastName}`} className="h-7 w-7 text-[11px]" />
                      <span className="font-medium text-[var(--ink)]">{l.firstName} {l.lastName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--ink-3)]">{l.email}</td>
                  <td className="px-4 py-3 text-[var(--ink-3)]">{l.externalId || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
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
