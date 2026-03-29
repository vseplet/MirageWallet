import {
  createWallet as tonCreateWallet,
  importWallet as tonImportWallet,
  formatAddress,
  getBalance,
  getTransactions,
  sendTon,
  type WalletData,
  type TxInfo,
  type SendResult,
} from "@/ton";
import { encryptAndSave, decryptMnemonic, hasVault, clearVault } from "@/vault";
import { DEFAULT_TX_LIMIT } from "@/config";

// ── In-memory wallet state ──────────────────────────────

let wallet: WalletData | null = null;
let cachedBalance = "0";

export function isUnlocked(): boolean {
  return wallet !== null;
}

export function hasExistingWallet(): boolean {
  return hasVault();
}

export function getWallet(): WalletData {
  if (!wallet) throw new Error("Wallet is locked");
  return wallet;
}

export function getAddress(): string {
  return formatAddress(getWallet().address);
}

export function lock(): void {
  wallet = null;
}

// ── Create ──────────────────────────────────────────────

export async function create(password: string): Promise<string[]> {
  const w = await tonCreateWallet();
  await encryptAndSave(w.mnemonic, password);
  wallet = w;
  return w.mnemonic;
}

// ── Import ──────────────────────────────────────────────

export async function importFromMnemonic(mnemonic: string[], password: string): Promise<void> {
  const w = await tonImportWallet(mnemonic);
  await encryptAndSave(w.mnemonic, password);
  wallet = w;
}

// ── Unlock ──────────────────────────────────────────────

export async function unlock(password: string): Promise<void> {
  const mnemonic = await decryptMnemonic(password);
  const w = await tonImportWallet(mnemonic);
  wallet = w;
}

// ── Reset ───────────────────────────────────────────────

export function reset(): void {
  wallet = null;
  clearVault();
}

// ── Balance ─────────────────────────────────────────────

export async function fetchBalance(): Promise<string> {
  cachedBalance = await getBalance(getWallet().address);
  return cachedBalance;
}

export function getCachedBalance(): string {
  return cachedBalance;
}

// ── Transactions ────────────────────────────────────────

export async function fetchTransactions(limit = DEFAULT_TX_LIMIT): Promise<TxInfo[]> {
  return getTransactions(getWallet().address, limit);
}

// ── Send ────────────────────────────────────────────────

export async function send(to: string, amount: string, comment?: string): Promise<SendResult> {
  return sendTon(getWallet(), to, amount, comment);
}
