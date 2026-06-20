// AES-256-GCM encryption for data at rest (offline IndexedDB store).
// Uses the Web Crypto API. Key is derived from a passphrase via PBKDF2.
//
// NOTE (Week 1 skeleton): the passphrase here is a dev placeholder. Production
// must derive this from the authenticated user's session / a device secret,
// never a hardcoded string. Tracked in HANDOFF.

const enc = new TextEncoder();
const dec = new TextDecoder();

const DEV_PASSPHRASE = 'meridian-dev-key-change-me';
const PBKDF2_ITERATIONS = 100_000;

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
export async function encrypt(value, passphrase = DEV_PASSPHRASE) {
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
export async function decrypt(payload, passphrase = DEV_PASSPHRASE) {
  const { salt, iv, data } = JSON.parse(payload);
  const key = await deriveKey(passphrase, fromB64(salt));
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(iv) },
    key,
    fromB64(data)
  );
  return JSON.parse(dec.decode(plaintext));
}
