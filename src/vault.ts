/**
 * Simple password-based encryption for mnemonic storage.
 * Uses Web Crypto API: PBKDF2 -> AES-GCM.
 */

import { STORAGE_KEY_VAULT, STORAGE_KEY_WHITELIST } from "@/config";

const SALT_LEN = 16;
const IV_LEN = 12;
const ITERATIONS = 100_000;

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptAndSave(mnemonic: string[], password: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(password, salt);

  const enc = new TextEncoder();
  const plaintext = enc.encode(mnemonic.join(" "));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );

  // Store as: salt(16) + iv(12) + ciphertext
  const combined = new Uint8Array(SALT_LEN + IV_LEN + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, SALT_LEN);
  combined.set(new Uint8Array(ciphertext), SALT_LEN + IV_LEN);

  const b64 = btoa(String.fromCharCode(...combined));
  localStorage.setItem(STORAGE_KEY_VAULT, b64);
}

export async function decryptMnemonic(password: string): Promise<string[]> {
  const b64 = localStorage.getItem(STORAGE_KEY_VAULT);
  if (!b64) throw new Error("No wallet found");

  const combined = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const salt = combined.slice(0, SALT_LEN);
  const iv = combined.slice(SALT_LEN, SALT_LEN + IV_LEN);
  const ciphertext = combined.slice(SALT_LEN + IV_LEN);

  const key = await deriveKey(password, salt);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );

  const dec = new TextDecoder();
  return dec.decode(plaintext).split(" ");
}

export function hasVault(): boolean {
  return localStorage.getItem(STORAGE_KEY_VAULT) !== null;
}

export function clearVault(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEY_WHITELIST);
}

// ── Address Whitelist ───────────────────────────────────

const WHITELIST_KEY = STORAGE_KEY_WHITELIST;

export function loadWhitelist(): string[] {
  try {
    return JSON.parse(localStorage.getItem(WHITELIST_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function addToWhitelist(address: string): void {
  const list = loadWhitelist();
  if (!list.includes(address)) {
    list.push(address);
    localStorage.setItem(WHITELIST_KEY, JSON.stringify(list));
  }
}
