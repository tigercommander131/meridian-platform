// Runtime theming: org accent (from backend) + local appearance prefs (density,
// motion) persisted in localStorage. Applied to <html> so CSS vars cascade.

const DENSITY_KEY = 'ctop_density';
const MOTION_KEY = 'ctop_motion';
const ACCENT_KEY = 'ctop_accent'; // cached so first paint isn't default-teal

export function applyAccent(hex) {
  if (typeof document === 'undefined' || !hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  const el = document.documentElement.style;
  el.setProperty('--accent', hex);
  el.setProperty('--accent-hover', `color-mix(in srgb, ${hex} 82%, black)`);
  el.setProperty('--accent-soft', `color-mix(in srgb, ${hex} 12%, white)`);
  el.setProperty('--accent-ink', `color-mix(in srgb, ${hex} 72%, black)`);
  try { localStorage.setItem(ACCENT_KEY, hex); } catch {}
}

export function getDensity() { try { return localStorage.getItem(DENSITY_KEY) || 'comfortable'; } catch { return 'comfortable'; } }
export function getMotion() { try { return localStorage.getItem(MOTION_KEY) || 'full'; } catch { return 'full'; } }
export function getCachedAccent() { try { return localStorage.getItem(ACCENT_KEY); } catch { return null; } }

export function setDensity(v) { try { localStorage.setItem(DENSITY_KEY, v); } catch {} apply(); }
export function setMotion(v) { try { localStorage.setItem(MOTION_KEY, v); } catch {} apply(); }

// Apply cached/local prefs immediately (call early, before data loads).
export function apply() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-density', getDensity());
  root.setAttribute('data-motion', getMotion() === 'reduce' ? 'reduce' : 'full');
  const cached = getCachedAccent();
  if (cached) applyAccent(cached);
}
