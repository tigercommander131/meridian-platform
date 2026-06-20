// AES-256-GCM encryption for data at rest (offline IndexedDB store).
// Uses the Web Crypto API. Key is derived from a passphrase via PBKDF2.
//
// The passphrase is derived per-device and per-user — never a shared constant.
// A high-entropy device secret is generated once (crypto RNG) and combined with
// the signed-in user's identity, so a copied IndexedDB blob is useless without
// that device's secret, and one user cannot read another's cached data.
// Residual risk: the device secret lives in localStorage (client-side). Full
// protection (server-held / hardware-backed key) is a deployment hardening step.

import { auth } from '@/services/api';

const enc = new TextEncoder();
const dec = new TextDecoder();

const DEVICE_SECRET_KEY = 'meridian_device_secret';
const PBKDF2_ITERATIONS = 100_000;

function getDeviceSecret() {
  if (typeof window === 'undefined') return 'ssr-no-secret';
  let s = localStorage.getItem(DEVICE_SECRET_KEY);
  if (!s) {
    s = toB64(crypto.getRandomValues(new Uint8Array(32)));
    localStorage.setItem(DEVICE_SECRET_KEY, s);
  }
  return s;
}

// Per-device, per-user passphrase. Defaults the encrypt/decrypt calls below.
export function sessionPassphrase() {
  const user = typeof window !== 'undefined' ? auth.getUser() : null;
  const uid = user?.id || user?.email || 'anon';
  return `${getDeviceSecret()}:${uid}`;
}

async function deriveKey(passphrase, salt) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function toB64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromB64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/**
 * Encrypt a JS value. Returns a self-contained string (salt + iv + ciphertext).
 */
export async function encrypt(value, passphrase = sessionPassphrase()) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const plaintext = enc.encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return JSON.stringify({
    v: 1,
    salt: toB64(salt),
    iv: toB64(iv),
    data: toB64(ciphertext),
  });
}

/**
 * Decrypt a string produced by encrypt(). Returns the original value.
 */
export async function decrypt(payload, passphrase = sessionPassphrase()) {
  const { salt, iv, data } = JSON.parse(payload);
  const key = await deriveKey(passphrase, fromB64(salt));
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(iv) },
    key,
    fromB64(data)
  );
  return JSON.parse(dec.decode(plaintext));
}
