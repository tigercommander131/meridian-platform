'use client';

import { useState, useEffect, useLayoutEffect, useCallback } from 'react';

// Lightweight first-run product tour. No dependencies: dims the page, spotlights
// the target element (via a big box-shadow "hole"), and shows a tooltip with
// Back / Next / Skip. Completion is remembered in localStorage.
//
// Relaunch from anywhere with: import { startTour } ... startTour().

const STORAGE_KEY = 'indigo_tour_done';

export function startTour() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('indigo:tour'));
}

export default function Tour({ steps }) {
  const [active, setActive] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [vp, setVp] = useState({ w: 1280, h: 800 });

  // Auto-start once per browser, after layout settles.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (localStorage.getItem(STORAGE_KEY)) return undefined;
    const t = setTimeout(() => setActive(true), 700);
    return () => clearTimeout(t);
  }, []);

  // Manual relaunch.
  useEffect(() => {
    function onStart() { setI(0); setActive(true); }
    window.addEventListener('indigo:tour', onStart);
    return () => window.removeEventListener('indigo:tour', onStart);
  }, []);

  const measure = useCallback(() => {
    setVp({ w: window.innerWidth, h: window.innerHeight });
    const sel = steps[i]?.selector;
    const el = sel ? document.querySelector(sel) : null;
    setRect(el ? el.getBoundingClientRect() : null);
  }, [steps, i]);

  useLayoutEffect(() => {
    if (!active) return undefined;
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [active, i, measure]);

  if (!active) return null;
  const step = steps[i];
  if (!step) return null;

  const finish = () => {
    setActive(false);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
  };
  const next = () => (i < steps.length - 1 ? setI(i + 1) : finish());
  const back = () => i > 0 && setI(i - 1);

  // Tooltip placement: below the target if it fits, else above; centered when
  // the step has no target.
  const TW = 320;
  const TH = 180;
  const GAP = 14;
  let left;
  let top;
  if (!rect) {
    left = vp.w / 2 - TW / 2;
    top = vp.h / 2 - TH / 2;
  } else {
    const fitsBelow = rect.bottom + GAP + TH < vp.h;
    top = fitsBelow ? rect.bottom + GAP : Math.max(12, rect.top - TH - GAP);
    left = Math.min(Math.max(12, rect.left), vp.w - TW - 12);
  }

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Block interaction with the page beneath. */}
      <div className="absolute inset-0" />

      {/* Spotlight (or full dim for targetless steps). */}
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-teal-400 transition-all duration-200"
          style={{
            left: rect.left - 4,
            top: rect.top - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow: '0 0 0 9999px rgba(15,23,42,0.55)',
          }}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0" style={{ background: 'rgba(15,23,42,0.55)' }} />
      )}

      {/* Tooltip */}
      <div
        className="absolute w-80 rounded-xl border border-neutral-200 bg-white p-4 shadow-xl transition-all duration-200"
        style={{ left, top }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">{step.tag || 'Getting started'}</span>
          <span className="text-xs text-neutral-400">{i + 1} / {steps.length}</span>
        </div>
        <p className="mt-1.5 text-sm font-semibold text-neutral-900">{step.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-neutral-600">{step.body}</p>

        <div className="mt-4 flex items-center justify-between">
          <button onClick={finish} className="text-xs text-neutral-400 hover:text-neutral-600">Skip tour</button>
          <div className="flex gap-2">
            {i > 0 && (
              <button onClick={back} className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100">
                Back
              </button>
            )}
            <button onClick={next} className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800">
              {i < steps.length - 1 ? 'Next' : 'Finish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
