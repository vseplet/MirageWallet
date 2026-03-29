import { TonClient, WalletContractV5R1 } from "@ton/ton";
import { mnemonicNew, mnemonicToPrivateKey, mnemonicValidate } from "@ton/crypto";
import { Address, toNano, fromNano, internal, SendMode } from "@ton/core";
import {
  TON_TESTNET_ENDPOINT,
  TON_API_KEY,
  ADDRESS_HIGHLIGHT_PREFIX,
  ADDRESS_HIGHLIGHT_SUFFIX,
  DEFAULT_TX_LIMIT,
  RETRY_COUNT,
  RETRY_BACKOFF_MS,
  API_THROTTLE_DELAY_MS,
} from "@/config";

// ── Client (injectable for testing) ─────────────────────

let client = new TonClient({
  endpoint: TON_TESTNET_ENDPOINT,
  apiKey: TON_API_KEY || undefined,
});

export function setClient(c: TonClient) {
  client = c;
}

export function getClient(): TonClient {
  return client;
}

// ── Types ───────────────────────────────────────────────

export interface WalletData {
  mnemonic: string[];
  publicKey: Buffer;
  secretKey: Buffer;
  address: Address;
  wallet: InstanceType<typeof WalletContractV5R1>;
}

export interface TxInfo {
  hash: string;
  time: number;
  from: string;
  to: string;
  amount: string;
  fee: string;
  incoming: boolean;
  comment: string;
}

export interface SendResult {
  success: boolean;
  error?: string;
}

// ── Wallet Creation / Import ────────────────────────────

export async function createWallet(): Promise<WalletData> {
  const mnemonic = await mnemonicNew();
  return importWallet(mnemonic);
}

export async function importWallet(mnemonic: string[]): Promise<WalletData> {
  const keyPair = await mnemonicToPrivateKey(mnemonic);
  const wallet = WalletContractV5R1.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  });

  return {
    mnemonic,
    publicKey: keyPair.publicKey,
    secretKey: keyPair.secretKey,
    address: wallet.address,
    wallet,
  };
}

export async function validateMnemonic(words: string[]): Promise<boolean> {
  return mnemonicValidate(words);
}

// ── Address Utilities ───────────────────────────────────

export function formatAddress(address: Address, bounceable = false): string {
  return address.toString({ testOnly: true, bounceable });
}

export function parseAddress(str: string): Address | null {
  try {
    return Address.parse(str);
  } catch {
    return null;
  }
}

export function isValidAddress(str: string): boolean {
  return parseAddress(str) !== null;
}

export function shortenAddress(str: string, prefixLen = ADDRESS_HIGHLIGHT_PREFIX, suffixLen = ADDRESS_HIGHLIGHT_SUFFIX): string {
  if (str.length <= prefixLen + suffixLen + 3) return str;
  return `${str.slice(0, prefixLen)}...${str.slice(-suffixLen)}`;
}

// ── Balance ─────────────────────────────────────────────

export async function getBalance(address: Address): Promise<string> {
  const balance = await client.getBalance(address);
  return fromNano(balance);
}

// ── Transactions ────────────────────────────────────────

export async function getTransactions(
  address: Address,
  limit = DEFAULT_TX_LIMIT,
): Promise<TxInfo[]> {
  const txs = await client.getTransactions(address, { limit });
  const myAddr = address.toString();

  return txs.map((tx) => {
    const inMsg = tx.inMessage;
    const outMsgs = tx.outMessages;

    const isIncoming = inMsg?.info.type === "internal" && !outMsgs.size;
    const firstOut = outMsgs.values()[0];

    let from = "";
    let to = "";
    let amount = "0";
    let comment = "";

    if (isIncoming && inMsg?.info.type === "internal") {
      from = inMsg.info.src?.toString() ?? "";
      to = myAddr;
      amount = fromNano(inMsg.info.value.coins);
      comment = extractComment(inMsg.body);
    } else if (firstOut?.info.type === "internal") {
      from = myAddr;
      to = firstOut.info.dest?.toString() ?? "";
      amount = fromNano(firstOut.info.value.coins);
      comment = extractComment(firstOut.body);
    }

    return {
      hash: tx.hash().toString("hex"),
      time: tx.now,
      from,
      to,
      amount,
      fee: fromNano(tx.totalFees.coins),
      incoming: isIncoming,
      comment,
    };
  });
}

function extractComment(body: import("@ton/core").Cell | undefined): string {
  if (!body) return "";
  try {
    const slice = body.beginParse();
    if (slice.loadUint(32) === 0) {
      return slice.loadStringTail();
    }
  } catch { /* not a text comment */ }
  return "";
}

// ── Transaction Search ──────────────────────────────────

export function searchTransactions(txs: TxInfo[], query: string): TxInfo[] {
  const q = query.toLowerCase().trim();
  if (!q) return txs;
  return txs.filter((tx) => {
    const signedAmount = tx.incoming ? `+${tx.amount}` : `-${tx.amount}`;
    return (
      tx.from.toLowerCase().includes(q) ||
      tx.to.toLowerCase().includes(q) ||
      tx.amount.includes(q) ||
      signedAmount.includes(q) ||
      tx.comment.toLowerCase().includes(q) ||
      tx.hash.toLowerCase().includes(q)
    );
  });
}

// ── Send ────────────────────────────────────────────────

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = RETRY_COUNT, backoff = RETRY_BACKOFF_MS): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err instanceof Error && err.message.includes("429");
      if (is429 && i < retries - 1) {
        await delay(backoff * (i + 1));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries reached");
}

export async function sendTon(
  walletData: WalletData,
  toAddress: string,
  amount: string,
  comment?: string,
): Promise<SendResult> {
  try {
    const dest = Address.parse(toAddress);
    const contract = client.open(walletData.wallet);

    const seqno = await withRetry(() => contract.getSeqno());

    await delay(API_THROTTLE_DELAY_MS);

    await withRetry(() =>
      contract.sendTransfer({
        seqno,
        secretKey: walletData.secretKey,
        sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        messages: [
          internal({
            to: dest,
            value: toNano(amount),
            body: comment || undefined,
            bounce: false,
          }),
        ],
      }),
    );

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Address Guard ───────────────────────────────────────

export interface AddressWarning {
  type: "new_address" | "clipboard_changed" | "self_send" | "address_poisoning";
  message: string;
}

export function checkAddressGuard(opts: {
  address: string;
  ownAddress: string;
  whitelist: string[];
  clipboardOriginal?: string;
}): AddressWarning[] {
  const warnings: AddressWarning[] = [];
  const addr = opts.address;

  // Self-send check
  if (addressesEqual(addr, opts.ownAddress)) {
    warnings.push({
      type: "self_send",
      message: "You are sending to your own address.",
    });
  }

  // Clipboard hijack check
  if (opts.clipboardOriginal && !addressesEqual(addr, opts.clipboardOriginal)) {
    warnings.push({
      type: "clipboard_changed",
      message: "The address changed after pasting. Possible clipboard hijack.",
    });
  }

  // Address poisoning check (similar to a whitelisted address but different in the middle)
  for (const known of opts.whitelist) {
    if (addressesEqual(addr, known)) continue; // exact match is fine
    if (addressesSimilar(addr, known)) {
      warnings.push({
        type: "address_poisoning",
        message: `This address looks similar to a known address (${shortenAddress(known)}) but differs. Possible address poisoning attack.`,
      });
      break;
    }
  }

  // New address check (not in whitelist)
  const isKnown = opts.whitelist.some((w) => addressesEqual(w, addr));
  if (!isKnown && !addressesEqual(addr, opts.ownAddress)) {
    warnings.push({
      type: "new_address",
      message: "This is a new address you haven't sent to before.",
    });
  }

  return warnings;
}

function addressesEqual(a: string, b: string): boolean {
  try {
    const addrA = Address.parse(a);
    const addrB = Address.parse(b);
    return addrA.equals(addrB);
  } catch {
    return a === b;
  }
}

function addressesSimilar(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  if (a.length < ADDRESS_HIGHLIGHT_PREFIX + ADDRESS_HIGHLIGHT_SUFFIX) return false;
  const prefixMatch = a.slice(0, ADDRESS_HIGHLIGHT_PREFIX) === b.slice(0, ADDRESS_HIGHLIGHT_PREFIX);
  const suffixMatch = a.slice(-ADDRESS_HIGHLIGHT_SUFFIX) === b.slice(-ADDRESS_HIGHLIGHT_SUFFIX);
  return prefixMatch && suffixMatch && a !== b;
}

// ── Send Validation ─────────────────────────────────────

export interface SendValidation {
  valid: boolean;
  error?: string;
}

export function validateSend(opts: {
  address: string;
  amount: string;
  balance: string;
}): SendValidation {
  if (!opts.address.trim()) {
    return { valid: false, error: "Enter recipient address" };
  }

  if (!isValidAddress(opts.address)) {
    return { valid: false, error: "Invalid TON address" };
  }

  const amount = Number(opts.amount);
  if (!opts.amount.trim() || isNaN(amount)) {
    return { valid: false, error: "Enter a valid amount" };
  }

  if (amount <= 0) {
    return { valid: false, error: "Amount must be greater than 0" };
  }

  const balance = Number(opts.balance);
  if (amount > balance) {
    return { valid: false, error: `Insufficient balance (${opts.balance} TON)` };
  }

  return { valid: true };
}
