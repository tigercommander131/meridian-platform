// Holds the last AI operations report so it survives navigation (e.g. dashboard
// → courses → back) without re-running (and re-billing) the report. Module-level
// state persists across client-side route changes; sessionStorage covers reloads.
let _report = null;
let _hydrated = false;
const subs = new Set();

function persist() {
  try { sessionStorage.setItem('ctop:report', JSON.stringify(_report)); } catch {}
}

export const reportStore = {
  get() {
    if (!_hydrated && typeof window !== 'undefined') {
      _hydrated = true;
      try { _report = JSON.parse(sessionStorage.getItem('ctop:report')) || null; } catch { _report = null; }
    }
    return _report;
  },
  set(r) { _report = r; persist(); subs.forEach((f) => f(r)); },
  clear() { _report = null; try { sessionStorage.removeItem('ctop:report'); } catch {} subs.forEach((f) => f(null)); },
  subscribe(f) { subs.add(f); return () => subs.delete(f); },
};
