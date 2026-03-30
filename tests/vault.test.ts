import { describe, test, expect, beforeEach } from "bun:test";
import {
  encryptAndSave,
  decryptMnemonic,
  hasVault,
  clearVault,
  loadWhitelist,
  addToWhitelist,
} from "@/vault";

// Mock localStorage for bun test environment
const storage = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); },
  removeItem: (k: string) => { storage.delete(k); },
  clear: () => storage.clear(),
  get length() { return storage.size; },
  key: (_i: number) => null,
} as Storage;

beforeEach(() => {
  storage.clear();
});

// ── Vault Encrypt/Decrypt ───────────────────────────────

describe("encryptAndSave / decryptMnemonic", () => {
  const mnemonic = "abandon ability able about above absent absorb abstract absurd abuse access accident"
    .split(" ")
    .concat("again age agent agree ahead aim air airport aisle alarm album alcohol".split(" "));

  test("encrypts and decrypts mnemonic correctly", async () => {
    await encryptAndSave(mnemonic, "password123");
    const result = await decryptMnemonic("password123");
    expect(result).toEqual(mnemonic);
  });

  test("wrong password throws", async () => {
    await encryptAndSave(mnemonic, "correct-password");
    expect(decryptMnemonic("wrong-password")).rejects.toThrow();
  });

  test("different passwords produce different ciphertexts", async () => {
    await encryptAndSave(mnemonic, "pass1");
    const cipher1 = storage.get("miragewallet_vault");

    await encryptAndSave(mnemonic, "pass2");
    const cipher2 = storage.get("miragewallet_vault");

    expect(cipher1).not.toBe(cipher2);
  });

  test("same password produces different ciphertexts (random salt/iv)", async () => {
    await encryptAndSave(mnemonic, "same-pass");
    const cipher1 = storage.get("miragewallet_vault");

    await encryptAndSave(mnemonic, "same-pass");
    const cipher2 = storage.get("miragewallet_vault");

    expect(cipher1).not.toBe(cipher2);
  });

  test("decrypting with no vault throws", async () => {
    expect(decryptMnemonic("password")).rejects.toThrow("No wallet found");
  });
});

// ── hasVault / clearVault ───────────────────────────────

describe("hasVault", () => {
  test("returns false when empty", () => {
    expect(hasVault()).toBe(false);
  });

  test("returns true after saving", async () => {
    await encryptAndSave(["test", "words"], "pass");
    expect(hasVault()).toBe(true);
  });

  test("returns false after clear", async () => {
    await encryptAndSave(["test", "words"], "pass");
    clearVault();
    expect(hasVault()).toBe(false);
  });
});

// ── Whitelist ───────────────────────────────────────────

describe("whitelist", () => {
  test("empty by default", () => {
    expect(loadWhitelist()).toEqual([]);
  });

  test("add and load", () => {
    addToWhitelist("EQAddr1");
    addToWhitelist("EQAddr2");
    expect(loadWhitelist()).toEqual(["EQAddr1", "EQAddr2"]);
  });

  test("no duplicates", () => {
    addToWhitelist("EQAddr1");
    addToWhitelist("EQAddr1");
    addToWhitelist("EQAddr1");
    expect(loadWhitelist()).toEqual(["EQAddr1"]);
  });

  test("clearVault also clears whitelist", async () => {
    addToWhitelist("EQAddr1");
    await encryptAndSave(["test"], "pass");
    clearVault();
    expect(loadWhitelist()).toEqual([]);
  });

  test("handles corrupted JSON gracefully", () => {
    storage.set("miragewallet_whitelist", "not-json{{{");
    expect(loadWhitelist()).toEqual([]);
  });
});
