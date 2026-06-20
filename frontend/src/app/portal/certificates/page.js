'use client';

import { useEffect, useState } from 'react';
import StudentShell from '@/components/layout/StudentShell';
import { studentApi } from '@/services/data';
import { downloadCertificatePdf } from '@/utils/certificatePdf';

function Certificates() {
  const [certs, setCerts] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await studentApi.certificates();
        setCerts(r.certificates);
      } catch {
        setCerts([]);
      }
    })();
  }, []);

  if (!certs) return <p className="text-sm text-neutral-500">Loading…</p>;

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Certificates</h1>
      <p className="mt-1 text-sm text-neutral-500">Download a certificate or share its verification link.</p>

      {certs.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-400">No certificates yet. They appear here once your trainer issues them.</p>
      ) : (
        <div className="mt-5 space-y-3">
          {certs.map((c) => (
            <div key={c.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-sm font-semibold text-neutral-900">{c.title}</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {c.organisation} · Issued {new Date(c.issuedAt).toLocaleDateString()}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => downloadCertificatePdf(c)}
                  className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
                >
                  Download PDF
                </button>
                <a
                  href={`/verify/${c.verificationCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100"
                >
                  Verification link
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function CertificatesPage() {
  return (
    <StudentShell>
      <Certificates />
    </StudentShell>
  );
}
