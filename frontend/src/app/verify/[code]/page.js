'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { certificatesApi } from '@/services/data';
import { LogoMark } from '@/components/brand/Logo';

function VerifyContent() {
  const { code } = useParams();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    (async () => {
      try {
        const r = await certificatesApi.verify(code);
        setState({ loading: false, ...r });
      } catch (e) {
        setState({ loading: false, valid: false, error: e.message });
      }
    })();
  }, [code]);

  if (state.loading) return <p className="text-sm text-neutral-500">Checking…</p>;

  const c = state.certificate;
  return (
    <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
      <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${state.valid ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-600'}`}>
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {state.valid ? <path d="M20 6 9 17l-5-5" /> : <path d="M18 6 6 18M6 6l12 12" />}
        </svg>
      </span>
      <p className="mt-3 text-sm font-semibold text-neutral-900">{state.valid ? 'Valid certificate' : 'Not valid'}</p>
      {c ? (
        <div className="mt-4 space-y-1 text-sm">
          <p className="font-medium text-neutral-900">{c.learnerName}</p>
          <p className="text-neutral-600">{c.title}</p>
          {c.course && <p className="text-neutral-500">{c.course}</p>}
          <p className="text-neutral-500">{c.organisation}</p>
          <p className="mt-1 text-xs text-neutral-400">
            Issued {c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : ''}{c.status !== 'issued' ? ` · ${c.status}` : ''}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-neutral-500">{state.error || 'Certificate not found.'}</p>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4">
      <div className="mb-6 flex items-center gap-2">
        <LogoMark className="h-8 w-8" />
        <span className="text-sm font-semibold text-neutral-900">Indigo Learning</span>
      </div>
      <VerifyContent />
    </div>
  );
}
