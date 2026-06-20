'use client';

import { useEffect, useRef, useState } from 'react';

// Camera QR scanner with a manual-entry fallback (for devices/environments
// without a usable camera). Calls onResult(decodedText) on a successful read.
export default function QrScanner({ onResult, onClose }) {
  const [cameraError, setCameraError] = useState('');
  const [manual, setManual] = useState('');
  const scannerRef = useRef(null);
  const READER_ID = 'qr-reader-region';

  useEffect(() => {
    let cancelled = false;
    let instance = null;

    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        instance = new Html5Qrcode(READER_ID, { verbose: false });
        scannerRef.current = instance;
        await instance.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 220 },
          (decoded) => {
            instance.stop().then(() => instance.clear()).catch(() => {});
            onResult(decoded);
          },
          () => {} // per-frame decode errors are noise; ignore
        );
      } catch (e) {
        if (!cancelled) setCameraError('Camera unavailable — enter the code manually.');
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop().then(() => s.clear()).catch(() => {});
      }
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-neutral-800">Scan QR code</p>
          <button onClick={onClose} className="text-sm text-neutral-400 hover:text-neutral-600">Close</button>
        </div>

        <div id={READER_ID} className="mt-3 overflow-hidden rounded-md bg-neutral-900" />

        {cameraError && <p className="mt-3 text-xs text-amber-700">{cameraError}</p>}

        <form
          onSubmit={(e) => { e.preventDefault(); if (manual.trim()) onResult(manual.trim()); }}
          className="mt-3 flex gap-2"
        >
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Or enter a code (e.g. SESSION_…)"
            className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
          <button type="submit" className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800">
            Go
          </button>
        </form>
      </div>
    </div>
  );
}
