'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader, Button, Badge, Field, Input, Select } from '@/components/ui/kit';
import { accreditationApi } from '@/services/data';
import { toast } from '@/stores/toastStore';

const DEFAULT_RULES = {
  groupSize: 6, minStudentsPerGroup: 4, instructorsPerGroup: 1, minGroups: 1,
  courseDirectorRequired: false, medicalDirectorRequired: true, courseDirectorCanBeMedicalDirector: true,
};

function RuleEditor({ courseTypes }) {
  const [courseTypeId, setCourseTypeId] = useState('');
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [versions, setVersions] = useState([]);

  const load = useCallback(async (ctId) => {
    if (!ctId) return;
    const r = await accreditationApi.listRuleSets(ctId);
    setVersions(r.ruleSets);
    setRules({ ...DEFAULT_RULES, ...(r.ruleSets[0]?.rules || {}) });
  }, []);
  useEffect(() => { if (courseTypeId) load(courseTypeId); }, [courseTypeId, load]);

  const num = (k) => (e) => setRules((s) => ({ ...s, [k]: parseInt(e.target.value, 10) || 0 }));
  const bool = (k) => (e) => setRules((s) => ({ ...s, [k]: e.target.checked }));

  async function save() {
    try { await accreditationApi.createRuleSet(courseTypeId, rules); toast.success('New rule version saved'); load(courseTypeId); }
    catch (e) { toast.error(e.message); }
  }

  return (
    <Card>
      <CardHeader title="Staffing rules" subtitle="Pick a course type, set its rules, save a new version. Existing courses keep the version in force when assessed."
        icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        action={courseTypeId ? <Badge tone="neutral">{versions.length} version{versions.length === 1 ? '' : 's'}</Badge> : null} />

      <Select value={courseTypeId} onChange={(e) => setCourseTypeId(e.target.value)} className="max-w-sm">
        <option value="">Select a course type…</option>
        {courseTypes.map((ct) => <option key={ct.id} value={ct.id}>{ct.accreditationName} — {ct.name}</option>)}
      </Select>

      {courseTypeId && (
        <>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-4">
              <Field label="Students per group (max)"><Input type="number" min="1" value={rules.groupSize} onChange={num('groupSize')} className="w-28" /></Field>
              <Field label="Min students per group"><Input type="number" min="1" value={rules.minStudentsPerGroup} onChange={num('minStudentsPerGroup')} className="w-28" /></Field>
              <Field label="Instructors per group"><Input type="number" min="1" value={rules.instructorsPerGroup} onChange={num('instructorsPerGroup')} className="w-28" /></Field>
              <Field label="Minimum groups"><Input type="number" min="1" value={rules.minGroups} onChange={num('minGroups')} className="w-28" /></Field>
            </div>
            <div className="space-y-2.5 rounded-xl bg-[var(--surface-2)] p-4 text-sm text-[var(--ink-2)]">
              <label className="flex items-center gap-2"><input type="checkbox" checked={rules.courseDirectorRequired} onChange={bool('courseDirectorRequired')} className="accent-[var(--accent)]" /> Course Director required</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={rules.medicalDirectorRequired} onChange={bool('medicalDirectorRequired')} className="accent-[var(--accent)]" /> Medical Director required (must be a doctor)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={rules.courseDirectorCanBeMedicalDirector} onChange={bool('courseDirectorCanBeMedicalDirector')} className="accent-[var(--accent)]" /> Course Director can also be the Medical Director</label>
            </div>
          </div>
          <Button onClick={save} className="mt-5">Save new version</Button>
        </>
      )}
    </Card>
  );
}

function AccreditationContent() {
  const [accreditation, setAccreditation] = useState([]);
  const [courseTypes, setCourseTypes] = useState([]);
  const [aName, setAName] = useState(''); const [aCode, setACode] = useState('');
  const [ctName, setCtName] = useState(''); const [ctCode, setCtCode] = useState(''); const [ctAccred, setCtAccred] = useState('');

  const load = useCallback(async () => {
    const [a, ct] = await Promise.all([accreditationApi.list(), accreditationApi.listCourseTypes()]);
    setAccreditation(a.accreditation); setCourseTypes(ct.courseTypes);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function addAccred() {
    if (!aName.trim() || !aCode.trim()) return toast.error('Name and code required');
    try { await accreditationApi.create({ name: aName.trim(), code: aCode.trim() }); setAName(''); setACode(''); load(); toast.success('Accreditation body added'); }
    catch (e) { toast.error(e.message); }
  }
  async function addCourseType() {
    if (!ctName.trim() || !ctAccred) return toast.error('Name and accreditation required');
    try { await accreditationApi.createCourseType({ name: ctName.trim(), code: ctCode.trim() || undefined, accreditationOrgId: ctAccred }); setCtName(''); setCtCode(''); load(); toast.success('Course type added'); }
    catch (e) { toast.error(e.message); }
  }

  return (
    <>
      <PageHeader title="Accreditation & Rules" subtitle="Define accreditation bodies, course types, and the staffing rules CTOP enforces." />

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Accreditation bodies" icon="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8z" />
          <ul className="space-y-1.5 text-sm">
            {accreditation.length === 0 ? <li className="text-[var(--ink-3)]">None yet.</li>
              : accreditation.map((a) => <li key={a.id} className="flex items-center gap-2 text-[var(--ink-2)]"><Badge tone="teal">{a.code}</Badge> {a.name}</li>)}
          </ul>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <Field label="Name" className="flex-1"><Input value={aName} onChange={(e) => setAName(e.target.value)} placeholder="Australian Resuscitation Council" /></Field>
            <Field label="Code"><Input value={aCode} onChange={(e) => setACode(e.target.value)} placeholder="ARC" className="w-24" /></Field>
            <Button onClick={addAccred}>Add</Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Course types" icon="M4 5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM14 3v5h5" />
          <ul className="space-y-1.5 text-sm">
            {courseTypes.length === 0 ? <li className="text-[var(--ink-3)]">None yet.</li>
              : courseTypes.map((ct) => <li key={ct.id} className="text-[var(--ink-2)]"><span className="text-[var(--ink-3)]">{ct.accreditationName} —</span> {ct.name}</li>)}
          </ul>
          <div className="mt-4 space-y-2">
            <Field label="Accreditation body">
              <Select value={ctAccred} onChange={(e) => setCtAccred(e.target.value)}>
                <option value="">Select…</option>
                {accreditation.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </Select>
            </Field>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Name" className="flex-1"><Input value={ctName} onChange={(e) => setCtName(e.target.value)} placeholder="Advanced Life Support 2" /></Field>
              <Field label="Code"><Input value={ctCode} onChange={(e) => setCtCode(e.target.value)} placeholder="ALS2" className="w-24" /></Field>
              <Button onClick={addCourseType}>Add</Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-5"><RuleEditor courseTypes={courseTypes} /></div>
    </>
  );
}

export default function AccreditationPage() {
  return (
    <AppShell>
      <AccreditationContent />
    </AppShell>
  );
}
