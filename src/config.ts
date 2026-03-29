// ── Layout ───────────────────────────────────────────────
export const POPUP_WIDTH = 360;
export const POPUP_HEIGHT = 500;
export const PADDING = 20;
export const BUTTON_HEIGHT = 48;
export const BUTTON_RADIUS = 10;
export const INPUT_HEIGHT = 40;
export const INPUT_RADIUS = 8;
export const PANEL_RADIUS = 12;

// ── Colors ───────────────────────────────────────────────
export const COLORS = {
  bg: 0x1a1a2e,
  panel: 0x16213e,

  accent: 0x6c63ff,
  accentHover: 0x8b83ff,
  accentPress: 0x4a42cc,

  danger: 0xe74c3c,
  dangerHover: 0xff6b6b,
  dangerPress: 0xc0392b,

  success: 0x2ecc71,
  successBg: 0x0a3d1a,

  warning: 0xf39c12,
  warningBg: 0x3d2e0a,

  text: 0xffffff,
  textDim: 0x8888aa,
  textMuted: 0x555577,

  inputBg: 0x0f3460,
  inputBorder: 0x6c63ff,

  keyConsonant: 0x0f3460,
  keyVowel: 0x2d6a4f,
  keyDigit: 0x4a3f6b,

  secondary: 0x16213e,
  secondaryHover: 0x1a2744,
  secondaryPress: 0x0f1a2e,
} as const;

// ── Typography ───────────────────────────────────────────
export const FONT_FAMILY = "system-ui, -apple-system, sans-serif";
export const FONT_SIZE = {
  title: 22,
  subtitle: 16,
  body: 14,
  hint: 13,
  small: 12,
  tiny: 10,
  button: 16,
  balance: 28,
  icon: 48,
} as const;

// ── Wallet ───────────────────────────────────────────────
export const AUTO_LOCK_SECONDS = 60;
export const MNEMONIC_WORD_COUNT = 24;
export const TON_DECIMALS = 9;
export const MIN_PASSWORD_LENGTH = 6;
export const DEFAULT_TX_LIMIT = 20;
export const FEEDBACK_TIMEOUT_MS = 2000;

// ── Network ──────────────────────────────────────────────
export const TON_TESTNET_ENDPOINT = "https://testnet.toncenter.com/api/v2/jsonRPC";
export const TON_API_KEY = ""; // Get free key from @tonapibot in Telegram
export const TON_TESTNET_EXPLORER = "https://testnet.tonscan.org";

// ── Polling & Network ───────────────────────────────────
export const POLL_INTERVAL_MS = 30_000;
export const API_THROTTLE_DELAY_MS = 1500;
export const RETRY_COUNT = 3;
export const RETRY_BACKOFF_MS = 2000;

// ── Virtual Keyboard ────────────────────────────────────
export const VK_COLS = 6;
export const VK_KEY_HEIGHT = 46;
export const VK_GAP = 4;
export const VK_DISPLAY_HEIGHT = 44;
export const VK_MAX_LENGTH = 32;
export const VK_DISPLAY_DOTS = 16;
export const VK_KEY_RADIUS = 8;
export const VK_DISPLAY_RADIUS = 10;

// ── Address Guard ────────────────────────────────────────
export const ADDRESS_HIGHLIGHT_PREFIX = 6;
export const ADDRESS_HIGHLIGHT_SUFFIX = 4;
export const SEND_WARNING_DELAY_MS = 3000;

// ── QR Code ─────────────────────────────────────────────
export const QR_CODE_SIZE = 160;
export const QR_CODE_MARGIN = 2;

// ── Storage Keys ────────────────────────────────────────
export const STORAGE_KEY_VAULT = "miragewallet_vault";
export const STORAGE_KEY_WHITELIST = "miragewallet_whitelist";

// ── App Info ────────────────────────────────────────────
export const APP_NAME = "MirageWallet";
export const APP_VERSION = "0.1.0";

// ── Strings ─────────────────────────────────────────────
export const S = {
  // Onboarding
  subtitle: "Self-custodial TON wallet",
  createWallet: "Create Wallet",
  importWallet: "Import Wallet",

  // Create
  seedTitle: "Your Seed Phrase",
  seedHint: "Hover over a word to reveal it. Write them down in order.",
  seedConfirm: "I've saved it",
  generating: "Generating wallet...",

  // Import
  importTitle: "Import Wallet",
  importHint: "Enter seed phrase word by word.",
  validating: "Validating...",
  invalidMnemonic: "Invalid mnemonic. Please try again.",

  // Password
  setPasswordTitle: "Set Password",
  unlockTitle: "Unlock Wallet",
  enterPassword: "Enter your password",
  step1: `Step 1: Enter password (min ${MIN_PASSWORD_LENGTH} chars)`,
  step2: "Step 2: Confirm password",
  passwordTooShort: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
  passwordsMismatch: "Passwords do not match. Try again.",
  creatingWallet: "Creating wallet...",
  decrypting: "Decrypting...",
  wrongPassword: "Wrong password",

  // Dashboard
  yourAddress: "Your address",
  loading: "Loading...",
  loadingTx: "Loading transactions...",
  noTransactions: "No transactions yet",
  transactions: "Transactions",
  receive: "Receive",
  send: "Send",
  tonscan: "Tonscan \u2197",
  settings: "\u2699 Settings",
  searchPlaceholder: "Search transactions...",
  noMatches: "No matches",
  hiddenBalance: "\u25CF\u25CF\u25CF\u25CF\u25CF TON",

  // Receive
  receiveTitle: "Receive TON",
  receiveHint: "Share this address to receive TON on testnet.",
  copyAddress: "Copy Address",
  copied: "Copied!",
  copyFailed: "Failed to copy",

  // Send
  sendTitle: "Send TON",
  recipientAddress: "Recipient address",
  amountTon: "Amount (TON)",
  balanceLoading: "Balance: loading...",
  review: "Review",
  cancel: "Cancel",
  addrPlaceholder: "EQ... or UQ...",
  amountPlaceholder: "0.00",
  invalidInput: "Invalid input",

  // Send Warning
  warningTitle: "Warning",
  riskDetected: "Potential risk detected.",
  sendAnyway: "Send Anyway",

  // Send Confirm
  confirmTitle: "Confirm Transaction",
  to: "To:",
  amount: "Amount:",
  confirmSend: "Confirm & Send",

  // Send Pending
  sending: "Sending...",
  waitingNetwork: "Waiting for network...",
  txFailed: "Transaction failed",

  // Send Success
  txSent: "Transaction Sent!",
  txSentHint: "It may take a few seconds to appear in history.",
  done: "Done",

  // Send Error
  txFailedTitle: "Transaction Failed",
  unknownError: "Unknown error",
  retry: "Retry",
  backToWallet: "Back to Wallet",

  // Settings
  settingsTitle: "Settings",
  resetWallet: "Reset Wallet",
  back: "Back",

  // Virtual Keyboard
  del: "\u2190 Del",
  vkDone: "Done",
  confirm: "Confirm",
} as const;
