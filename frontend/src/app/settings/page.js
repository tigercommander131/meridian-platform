'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader, Button, Badge, Field, Input, Icon, cx } from '@/components/ui/kit';
import { orgApi } from '@/services/data';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/stores/toastStore';
import { applyAccent, setDensity, setMotion, getDensity, getMotion } from '@/utils/appearance';

// Curated accents — single-accent, no purple (per design system).
const ACCENTS = [
  ['#0f766e', 'Teal'], ['#047857', 'Emerald'], ['#0e7490', 'Cyan'],
  ['#1d4ed8', 'Blue'], ['#b45309', 'Amber'], ['#be123c', 'Rose'], ['#334155', 'Slate'],
];

function OrgProfile({ canEdit }) {
  const [org, setOrg] = useState(null);
  const [err, setErr] = useState(null);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [accent, setAccent] = useState('#0f766e');
  const [regions, setRegions] = useState([]);
  const [newRegion, setNewRegion] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => orgApi.get().then((o) => {
    setOrg(o); setName(o.name || ''); setTagline(o.tagline || '');
    setAccent(o.accent || '#0f766e'); setRegions(o.regions || []);
  }).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  if (err) return (
    <Card>
      <CardHeader title="Organisation" subtitle="Name, branding, and default regions." icon="M3 21h18M5 21V7l8-4 8 4v14M9 9h.01M9 13h.01M9 17h.01M13 9h.01M13 13h.01M13 17h.01" />
      <p className="text-sm text-[var(--ink-3)]">Couldn’t load the organisation profile ({err}). It may not be available until the latest deploy completes.</p>
    </Card>
  );

  function pickAccent(hex) { setAccent(hex); applyAccent(hex); } // live preview
  function addRegion() { const r = newRegion.trim(); if (r && !regions.includes(r)) setRegions((s) => [...s, r]); setNewRegion(''); }

  async function save() {
    setBusy(true);
    try { const o = await orgApi.update({ name, tagline, accent, regions }); setOrg(o); applyAccent(o.accent); toast.success('Organisation saved'); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  if (!org) return <Card><div className="h-32 animate-pulse rounded-xl bg-neutral-100" /></Card>;

  return (
    <Card>
      <CardHeader title="Organisation" subtitle="Name, branding, and default regions." icon="M3 21h18M5 21V7l8-4 8 4v14M9 9h.01M9 13h.01M9 17h.01M13 9h.01M13 13h.01M13 17h.01" />
      {!canEdit && <Badge tone="amber" className="mb-3">Read-only — admin role required to edit</Badge>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Organisation name"><Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Tagline"><Input value={tagline} onChange={(e) => setTagline(e.target.value)} disabled={!canEdit} placeholder="Short strapline" /></Field>
      </div>

      <div className="mt-4">
        <p className="lbl">Accent colour</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ACCENTS.map(([hex, label]) => (
            <button key={hex} type="button" disabled={!canEdit} onClick={() => pickAccent(hex)} title={label}
              className={cx('h-8 w-8 rounded-full ring-2 ring-offset-2 transition', accent.toLowerCase() === hex ? 'ring-[var(--ink)]' : 'ring-transparent')}
              style={{ backgroundColor: hex }} />
          ))}
        </div>
      </div>

      <div className="mt-4">
        <p className="lbl">Default regions</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {regions.map((r) => (
            <span key={r} className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] py-1 pl-2.5 pr-1 text-sm">
              {r}{canEdit && <button onClick={() => setRegions((s) => s.filter((x) => x !== r))} className="rounded p-0.5 text-[var(--ink-3)] hover:text-rose-600"><Icon d="M18 6L6 18M6 6l12 12" className="h-3.5 w-3.5" /></button>}
            </span>
          ))}
          {regions.length === 0 && <span className="text-sm text-[var(--ink-3)]">None yet.</span>}
        </div>
        {canEdit && (
          <div className="mt-2 flex max-w-xs gap-2">
            <Input value={newRegion} onChange={(e) => setNewRegion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRegion())} placeholder="Add region…" />
            <Button variant="secondary" onClick={addRegion}>Add</Button>
          </div>
        )}
      </div>

      {canEdit && <Button onClick={save} disabled={busy} className="mt-5">{busy ? 'Saving…' : 'Save organisation'}</Button>}
    </Card>
  );
}

function Toggle({ label, options, value, onChange }) {
  return (
    <div>
      <p className="lbl">{label}</p>
      <div className="mt-2 inline-flex rounded-lg border border-[var(--line-2)] p-0.5">
        {options.map(([v, l]) => (
          <button key={v} onClick={() => onChange(v)}
            className={cx('rounded-md px-3 py-1.5 text-sm transition-colors', value === v ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink-2)] hover:text-[var(--ink)]')}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Appearance() {
  const [density, setD] = useState('comfortable');
  const [motion, setM] = useState('full');
  useEffect(() => { setD(getDensity()); setM(getMotion()); }, []);

  return (
    <Card>
      <CardHeader title="Appearance" subtitle="Personal display preferences (saved on this device)." icon="M12 3v2M12 19v2M5 12H3M21 12h-2M7.8 7.8 6.3 6.3M17.7 17.7l-1.5-1.5M7.8 16.2l-1.5 1.5M17.7 6.3l-1.5 1.5M12 8a4 4 0 100 8 4 4 0 000-8z" />
      <div className="flex flex-wrap gap-8">
        <Toggle label="Density" value={density} onChange={(v) => { setD(v); setDensity(v); }} options={[['comfortable', 'Comfortable'], ['compact', 'Compact']]} />
        <Toggle label="Motion" value={motion} onChange={(v) => { setM(v); setMotion(v); }} options={[['full', 'Full'], ['reduce', 'Reduced']]} />
      </div>
    </Card>
  );
}

function SettingsContent() {
  const { user } = useAuth();
  const canEdit = user?.roles?.some((r) => ['admin', 'organisation_admin'].includes(r));
  return (
    <>
      <PageHeader title="Settings" subtitle="Organisation profile and your display preferences." />
      <div className="mt-6 space-y-5">
        <OrgProfile canEdit={canEdit} />
        <Appearance />
      </div>
    </>
  );
}

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsContent />
    </AppShell>
  );
}
