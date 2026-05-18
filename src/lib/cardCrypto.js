// Card Data Encryption Utility - AES-GCM 256-bit
// Uses the Web Crypto API (built-in in all modern browsers).
// Encryption key is stored in .env as VITE_CARD_ENCRYPTION_KEY.

const SECRET = import.meta.env.VITE_CARD_ENCRYPTION_KEY || 'AMS-CRM-Internal-2025-Key!@#';

async function getKey(secret) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('ams-crm-salt'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt a plain text string (card number, CVV, etc.)
// Returns a base64-encoded encrypted string safe for DB storage.
export async function encryptCard(text) {
  if (!text) return null;
  try {
    const key = await getKey(SECRET);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(String(text)));
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
  } catch (e) {
    console.error('Encryption failed:', e);
    return null;
  }
}

// Decrypt a previously encrypted card string.
// Returns null if decryption fails (wrong key, corrupted data, etc.)
export async function decryptCard(encryptedText) {
  if (!encryptedText) return null;
  try {
    const key = await getKey(SECRET);
    const combined = new Uint8Array(
      atob(encryptedText).split('').map(c => c.charCodeAt(0))
    );
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

// Returns masked display format.
export function maskCard(cardNumber) {
  if (!cardNumber) return '—';
  const last4 = String(cardNumber).slice(-4);
  return `**** **** **** ${last4}`;
}

export function maskCvv() {
  return '***';
}

export function maskExpiry(expiry) {
  if (!expiry) return '—';
  return expiry.replace(/\d(?=\d{2}$)/, '*').replace(/\d/g, (c, i) => i < 2 ? c : '*');
}
