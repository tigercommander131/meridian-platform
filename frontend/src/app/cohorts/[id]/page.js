'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode';
import AppShell from '@/components/layout/AppShell';
import ExportsPanel from '@/components/exports/ExportsPanel';
import { cohortsApi } from '@/services/data';

function CohortDetail() {
  const { id } = useParams();
  const [cohort, setCohort] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const c = await cohortsApi.get(id);
        setCohort(c);
        if (c.qrCode) {
          setQrDataUrl(await QRCode.toDataURL(c.qrCode, { width: 240, margin: 1 }));
        }
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [id]);

  if (error) return <p className="text-sm text-amber-700">{error}</p>;
  if (!cohort) return <p className="text-sm text-neutral-500">Loading…</p>;

  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{cohort.name}</h1>
          <p className="mt-1 text-sm text-neutral-500">{cohort.learners.length} learner(s)</p>
        </div>
        <button onClick={() => window.print()}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100">
          Print QR poster
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
          <p className="text-sm font-medium text-neutral-700">Check-in QR</p>
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="Cohort check-in QR" className="mx-auto mt-3" width={240} height={240} />
          )}
          <p className="mt-2 break-all text-xs text-neutral-400">{cohort.qrCode}</p>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-5">
          <p className="text-sm font-medium text-neutral-700">Roster</p>
          <ul className="mt-2 divide-y divide-neutral-100">
            {cohort.learners.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-neutral-800">{l.firstName} {l.lastName}</span>
                <span className="text-xs text-neutral-400">{l.email}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ExportsPanel cohortId={id} />
    </>
  );
}

export default function CohortDetailPage() {
  return (
    <AppShell>
      <CohortDetail />
    </AppShell>
  );
}
