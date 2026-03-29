import { describe, test, expect } from "bun:test";
import {
  createWallet,
  importWallet,
  validateMnemonic,
  formatAddress,
  parseAddress,
  isValidAddress,
  shortenAddress,
  searchTransactions,
  checkAddressGuard,
  validateSend,
  type TxInfo,
} from "@/ton";

// ── Wallet Creation ─────────────────────────────────────

describe("createWallet", () => {
  test("generates 24-word mnemonic and valid address", async () => {
    const w = await createWallet();
    expect(w.mnemonic).toHaveLength(24);
    expect(w.mnemonic.every((word) => typeof word === "string" && word.length > 0)).toBe(true);
    expect(w.publicKey).toBeInstanceOf(Buffer);
    expect(w.secretKey).toBeInstanceOf(Buffer);
    expect(w.publicKey.length).toBe(32);
    expect(w.secretKey.length).toBe(64);
    expect(w.address).toBeDefined();
    expect(w.wallet).toBeDefined();
  });

  test("two wallets produce different addresses", async () => {
    const w1 = await createWallet();
    const w2 = await createWallet();
    expect(w1.address.equals(w2.address)).toBe(false);
  });
});

// ── Wallet Import ───────────────────────────────────────

describe("importWallet", () => {
  test("same mnemonic produces same address", async () => {
    const w1 = await createWallet();
    const w2 = await importWallet(w1.mnemonic);
    expect(w1.address.equals(w2.address)).toBe(true);
    expect(w1.publicKey.equals(w2.publicKey)).toBe(true);
  });
});

// ── Mnemonic Validation ─────────────────────────────────

describe("validateMnemonic", () => {
  test("valid mnemonic returns true", async () => {
    const w = await createWallet();
    expect(await validateMnemonic(w.mnemonic)).toBe(true);
  });

  test("garbage words return false", async () => {
    const garbage = Array.from({ length: 24 }, (_, i) => `garbage${i}`);
    expect(await validateMnemonic(garbage)).toBe(false);
  });

  test("wrong word count returns false", async () => {
    expect(await validateMnemonic(["hello", "world"])).toBe(false);
  });

  test("empty array returns false", async () => {
    expect(await validateMnemonic([])).toBe(false);
  });
});

// ── Address Utilities ───────────────────────────────────

describe("formatAddress", () => {
  test("produces testnet non-bounceable address by default", async () => {
    const w = await createWallet();
    const addr = formatAddress(w.address);
    // Testnet non-bounceable addresses start with 0Q
    expect(addr.startsWith("0Q") || addr.startsWith("0:")).toBe(true);
  });

  test("bounceable flag changes output", async () => {
    const w = await createWallet();
    const nonBounce = formatAddress(w.address, false);
    const bounce = formatAddress(w.address, true);
    expect(nonBounce).not.toBe(bounce);
  });
});

describe("parseAddress", () => {
  test("valid address parses successfully", async () => {
    const w = await createWallet();
    const str = formatAddress(w.address);
    const parsed = parseAddress(str);
    expect(parsed).not.toBeNull();
    expect(parsed!.equals(w.address)).toBe(true);
  });

  test("invalid address returns null", () => {
    expect(parseAddress("not-an-address")).toBeNull();
    expect(parseAddress("")).toBeNull();
    expect(parseAddress("EQ")).toBeNull();
  });
});

describe("isValidAddress", () => {
  test("valid address returns true", async () => {
    const w = await createWallet();
    expect(isValidAddress(formatAddress(w.address))).toBe(true);
  });

  test("invalid address returns false", () => {
    expect(isValidAddress("")).toBe(false);
    expect(isValidAddress("hello")).toBe(false);
    expect(isValidAddress("EQ1234")).toBe(false);
  });
});

describe("shortenAddress", () => {
  test("shortens long address", () => {
    const addr = "EQAbcdefghijklmnopqrstuvwxyz123456789abcdefgh";
    expect(shortenAddress(addr)).toBe("EQAbcd...efgh");
  });

  test("returns short string as-is", () => {
    expect(shortenAddress("short")).toBe("short");
  });

  test("custom prefix/suffix lengths", () => {
    const addr = "EQAbcdefghijklmnopqrstuvwxyz123456789abcdefgh";
    expect(shortenAddress(addr, 4, 6)).toBe("EQAb...cdefgh");
  });
});

// ── Transaction Search ──────────────────────────────────

describe("searchTransactions", () => {
  const txs: TxInfo[] = [
    {
      hash: "aabbcc",
      time: 1000,
      from: "EQSender111",
      to: "EQReceiver222",
      amount: "1.5",
      fee: "0.01",
      incoming: true,
      comment: "payment for coffee",
    },
    {
      hash: "ddeeff",
      time: 2000,
      from: "EQMe",
      to: "EQShop333",
      amount: "10.0",
      fee: "0.02",
      incoming: false,
      comment: "nft purchase",
    },
    {
      hash: "112233",
      time: 3000,
      from: "EQFriend444",
      to: "EQMe",
      amount: "0.5",
      fee: "0.01",
      incoming: true,
      comment: "",
    },
  ];

  test("empty query returns all", () => {
    expect(searchTransactions(txs, "")).toHaveLength(3);
    expect(searchTransactions(txs, "  ")).toHaveLength(3);
  });

  test("search by address", () => {
    expect(searchTransactions(txs, "sender")).toHaveLength(1);
    expect(searchTransactions(txs, "shop")).toHaveLength(1);
  });

  test("search by amount", () => {
    expect(searchTransactions(txs, "1.5")).toHaveLength(1);
    expect(searchTransactions(txs, "10.0")).toHaveLength(1);
  });

  test("search by comment", () => {
    expect(searchTransactions(txs, "coffee")).toHaveLength(1);
    expect(searchTransactions(txs, "nft")).toHaveLength(1);
  });

  test("search by hash", () => {
    expect(searchTransactions(txs, "aabbcc")).toHaveLength(1);
  });

  test("case insensitive", () => {
    expect(searchTransactions(txs, "COFFEE")).toHaveLength(1);
    expect(searchTransactions(txs, "NFT")).toHaveLength(1);
  });

  test("no match returns empty", () => {
    expect(searchTransactions(txs, "nonexistent")).toHaveLength(0);
  });
});

// ── Address Guard ───────────────────────────────────────

describe("checkAddressGuard", () => {
  test("new address warning", () => {
    const warnings = checkAddressGuard({
      address: "EQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqYENkWsIL0XggGG",
      ownAddress: "EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2",
      whitelist: [],
    });
    expect(warnings.some((w) => w.type === "new_address")).toBe(true);
  });

  test("self-send warning", async () => {
    const w = await createWallet();
    const addr = formatAddress(w.address);
    const warnings = checkAddressGuard({
      address: addr,
      ownAddress: addr,
      whitelist: [],
    });
    expect(warnings.some((w) => w.type === "self_send")).toBe(true);
  });

  test("clipboard changed warning", () => {
    const warnings = checkAddressGuard({
      address: "EQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqYENkWsIL0XggGG",
      ownAddress: "EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2",
      whitelist: [],
      clipboardOriginal: "EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2",
    });
    expect(warnings.some((w) => w.type === "clipboard_changed")).toBe(true);
  });

  test("no clipboard warning when addresses match", () => {
    const addr = "EQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqYENkWsIL0XggGG";
    const warnings = checkAddressGuard({
      address: addr,
      ownAddress: "EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2",
      whitelist: [addr],
      clipboardOriginal: addr,
    });
    expect(warnings.some((w) => w.type === "clipboard_changed")).toBe(false);
  });

  test("whitelisted address produces no new_address warning", () => {
    const addr = "EQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqYENkWsIL0XggGG";
    const warnings = checkAddressGuard({
      address: addr,
      ownAddress: "EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2",
      whitelist: [addr],
    });
    expect(warnings.some((w) => w.type === "new_address")).toBe(false);
  });

  test("address poisoning: similar prefix+suffix, different middle", () => {
    // Simulate two addresses that share prefix and suffix but differ in middle
    const known =  "ABCDEFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxYZQR";
    const poison = "ABCDEFzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzYZQR";
    const warnings = checkAddressGuard({
      address: poison,
      ownAddress: "DIFFERENT_ADDRESS_12345678901234567890123456",
      whitelist: [known],
    });
    expect(warnings.some((w) => w.type === "address_poisoning")).toBe(true);
  });
});

// ── Send Validation ─────────────────────────────────────

describe("validateSend", () => {
  const validAddr = "EQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqYENkWsIL0XggGG";

  test("valid send", () => {
    const r = validateSend({ address: validAddr, amount: "1.5", balance: "10.0" });
    expect(r.valid).toBe(true);
    expect(r.error).toBeUndefined();
  });

  test("empty address", () => {
    const r = validateSend({ address: "", amount: "1.0", balance: "10.0" });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("address");
  });

  test("invalid address", () => {
    const r = validateSend({ address: "not-valid", amount: "1.0", balance: "10.0" });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("Invalid");
  });

  test("empty amount", () => {
    const r = validateSend({ address: validAddr, amount: "", balance: "10.0" });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("amount");
  });

  test("non-numeric amount", () => {
    const r = validateSend({ address: validAddr, amount: "abc", balance: "10.0" });
    expect(r.valid).toBe(false);
  });

  test("zero amount", () => {
    const r = validateSend({ address: validAddr, amount: "0", balance: "10.0" });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("greater than 0");
  });

  test("negative amount", () => {
    const r = validateSend({ address: validAddr, amount: "-5", balance: "10.0" });
    expect(r.valid).toBe(false);
  });

  test("amount exceeds balance", () => {
    const r = validateSend({ address: validAddr, amount: "15.0", balance: "10.0" });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("Insufficient");
  });

  test("amount equals balance", () => {
    const r = validateSend({ address: validAddr, amount: "10.0", balance: "10.0" });
    expect(r.valid).toBe(true);
  });
});
