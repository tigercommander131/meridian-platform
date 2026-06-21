'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/ui/PageHeader';
import { accreditationApi } from '@/services/data';
import { toast } from '@/stores/toastStore';

const field = 'rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600';

const DEFAULT_RULES = {
  groupSize: 6, instructorsPerGroup: 2, courseDirectorRequired: true, medicalLeadRequired: true,
  courseDirectorCanBeMedicalLead: true, extraDoctorWhenGroupsExceed: 2, countICsAsInstructors: false,
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
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <p className="text-sm font-medium text-neutral-700">Staffing rules</p>
      <p className="mt-0.5 text-xs text-neutral-500">Pick a course type, set its rules, save a new version. Existing courses keep using the version in force when assessed.</p>

      <select value={courseTypeId} onChange={(e) => setCourseTypeId(e.target.value)} className={`${field} mt-3 block w-full max-w-sm`}>
        <option value="">Select a course type…</option>
        {courseTypes.map((ct) => <option key={ct.id} value={ct.id}>{ct.accreditationName} — {ct.name}</option>)}
      </select>

      {courseTypeId && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm text-neutral-700">Students per group
              <input type="number" min="1" value={rules.groupSize} onChange={num('groupSize')} className={`${field} mt-1 block w-24`} /></label>
            <label className="text-sm text-neutral-700">Instructors per group
              <input type="number" min="1" value={rules.instructorsPerGroup} onChange={num('instructorsPerGroup')} className={`${field} mt-1 block w-24`} /></label>
            <label className="text-sm text-neutral-700">Extra doctor when groups exceed
              <input type="number" min="0" value={rules.extraDoctorWhenGroupsExceed} onChange={num('extraDoctorWhenGroupsExceed')} className={`${field} mt-1 block w-24`} /></label>
            <div className="space-y-1.5 pt-1 text-sm text-neutral-700">
              <label className="flex items-center gap-2"><input type="checkbox" checked={rules.courseDirectorRequired} onChange={bool('courseDirectorRequired')} /> Course director required</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={rules.medicalLeadRequired} onChange={bool('medicalLeadRequired')} /> Medical lead required</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={rules.courseDirectorCanBeMedicalLead} onChange={bool('courseDirectorCanBeMedicalLead')} /> Course director can be the medical lead</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={rules.countICsAsInstructors} onChange={bool('countICsAsInstructors')} /> Count candidates as instructors</label>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={save} className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800">Save new version</button>
            <span className="text-xs text-neutral-400">{versions.length} version{versions.length === 1 ? '' : 's'} on record</span>
          </div>
        </>
      )}
    </div>
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

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <p className="text-sm font-medium text-neutral-700">Accreditation bodies</p>
          <ul className="mt-2 space-y-1 text-sm">
            {accreditation.length === 0 ? <li className="text-neutral-400">None yet.</li>
              : accreditation.map((a) => <li key={a.id} className="text-neutral-800"><span className="font-medium">{a.code}</span> — {a.name}</li>)}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <input value={aName} onChange={(e) => setAName(e.target.value)} placeholder="Name (e.g. Australian Resuscitation Council)" className={`${field} flex-1`} />
            <input value={aCode} onChange={(e) => setACode(e.target.value)} placeholder="Code (ARC)" className={`${field} w-24`} />
            <button onClick={addAccred} className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800">Add</button>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <p className="text-sm font-medium text-neutral-700">Course types</p>
          <ul className="mt-2 space-y-1 text-sm">
            {courseTypes.length === 0 ? <li className="text-neutral-400">None yet.</li>
              : courseTypes.map((ct) => <li key={ct.id} className="text-neutral-800">{ct.accreditationName} — {ct.name}</li>)}
          </ul>
          <div className="mt-3 space-y-2">
            <select value={ctAccred} onChange={(e) => setCtAccred(e.target.value)} className={`${field} block w-full`}>
              <option value="">Accreditation body…</option>
              {accreditation.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
            <div className="flex flex-wrap gap-2">
              <input value={ctName} onChange={(e) => setCtName(e.target.value)} placeholder="Name (Advanced Life Support 2)" className={`${field} flex-1`} />
              <input value={ctCode} onChange={(e) => setCtCode(e.target.value)} placeholder="Code (ALS2)" className={`${field} w-24`} />
              <button onClick={addCourseType} className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800">Add</button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <RuleEditor courseTypes={courseTypes} />
      </div>
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
