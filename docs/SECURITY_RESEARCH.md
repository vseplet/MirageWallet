# Browser-Based Crypto Wallet Security Research

Compiled: March 2026

---

## Table of Contents

1. [Threat Vector 1: Keyloggers](#1-keyloggers-software-and-browser-based)
2. [Threat Vector 2: Clipboard Sniffers/Hijackers](#2-clipboard-sniffershijackers)
3. [Threat Vector 3: Malicious Browser Extensions](#3-malicious-browser-extensions)
4. [Threat Vector 4: Screen Capture Malware](#4-screen-capture-malware)
5. [Threat Vector 5: Memory Scraping](#5-memory-scraping)
6. [Cross-Cutting Countermeasures](#6-cross-cutting-countermeasures)
7. [Cutting-Edge Approaches](#7-cutting-edge-approaches)
8. [Implementation Priority Matrix](#8-implementation-priority-matrix)
9. [Sources](#9-sources)

---

## 1. Keyloggers (Software and Browser-Based)

### Threat Description

Keyloggers intercept physical keyboard input at the OS level (device drivers, kernel hooks) or at the browser level (JavaScript `keydown`/`keyup`/`keypress` event listeners injected by malicious extensions or compromised pages). The Torg Grabber malware (March 2026) targets 728+ crypto wallets using ClickFix technique to hijack input.

### Countermeasures

#### A. Virtual/On-Screen Keyboard

- **How it works**: Renders a clickable keyboard in the UI; user clicks characters with the mouse/touch instead of typing. No physical key events are generated.
- **Strengths**: Defeats hardware keyloggers and most software keyloggers that hook keyboard drivers. Banking apps (Kaspersky, Oxynger) have used this approach for years.
- **Weaknesses**: Sophisticated malware can track mouse coordinates and correlate clicks with character positions. Screen capture malware can observe the keyboard. Randomizing character positions on each use mitigates coordinate tracking.
- **Implementation**: Render inside a Shadow DOM or sandboxed iframe to prevent DOM inspection. Randomize key layout per session. Use CSS `pointer-events` carefully to prevent overlay attacks.

#### B. WebAuthn/Passkeys (Eliminate Keyboard Entry Entirely)

- **How it works**: Replace password/seed-phrase entry with biometric or hardware-token authentication via WebAuthn. The private key never leaves the authenticator's secure enclave.
- **Strengths**: No keyboard input to intercept. The private key is non-extractable by design -- it resides in the device's Secure Enclave (Apple), TPM (Windows), or security key hardware.
- **Weaknesses**: Requires user to have a compatible device. Recovery flows still need careful design.
- **Implementation**: Use the WebAuthn API with `userVerification: "required"`. See Section 6C for PRF extension details.

#### C. Input Obfuscation Techniques

- **How it works**: Instead of typing a full seed phrase, use a selection-based interface (dropdowns, drag-and-drop word tiles) that never involves keyboard events.
- **Strengths**: Completely bypasses keyboard event capture. Works in all browsers.
- **Weaknesses**: Slower UX. Still vulnerable to screen capture.
- **Implementation**: Render word selection tiles inside Shadow DOM. Shuffle order. Use `autocomplete="off"` and `inputmode="none"` on any fallback inputs.

---

## 2. Clipboard Sniffers/Hijackers

### Threat Description

Malware monitors the system clipboard (e.g., ClipXDaemon polls every 200ms on Linux/X11) and replaces cryptocurrency addresses with attacker-controlled addresses. This is one of the most common and effective attack vectors -- users copy a destination address and unknowingly paste the attacker's address.

### Countermeasures

#### A. Address Verification UI

- **How it works**: After any paste operation, display a prominent visual comparison of the pasted address against the intended address. Highlight the first and last N characters.
- **Strengths**: Catches replacements even if the clipboard was hijacked. Low implementation cost.
- **Implementation**: Intercept `paste` events, compare clipboard content before and after a short delay, warn if content changed externally.

#### B. QR Code / Direct Transfer

- **How it works**: Display destination addresses as QR codes. Use WalletConnect or similar protocol for direct wallet-to-wallet communication without clipboard.
- **Strengths**: Completely bypasses clipboard. QR codes are immune to clipboard hijacking.
- **Weaknesses**: Requires camera or second device for QR. WalletConnect adds complexity.

#### C. Clipboard Isolation

- **How it works**: Use the Clipboard API (`navigator.clipboard.writeText()`) within the extension's isolated context rather than the system clipboard. Opera Browser's "Paste Protection" monitors for external clipboard modification and warns users.
- **Strengths**: Extension background scripts have their own clipboard context in some browsers.
- **Weaknesses**: Cannot fully control what happens at the OS level once data enters the system clipboard.

#### D. Address Checksumming and Whitelisting

- **How it works**: Validate pasted addresses against known address formats (EIP-55 checksum for Ethereum). Maintain a user-approved address whitelist. Require explicit confirmation for new addresses.
- **Strengths**: Invalid or modified addresses are caught automatically.
- **Implementation**: Validate on every paste. Show full address in a non-copyable format for verification.

---

## 3. Malicious Browser Extensions

### Threat Description

This is the most dangerous threat vector for browser-based wallets. Extensions have **full and unfettered access to the DOM** of every web page visited. In 2025, personal wallet hacks via browser extensions caused $713M in losses. Key attacks include:

- DOM-based clickjacking against password managers and wallets (August 2025)
- Content scripts reading input fields where users type passwords/seed phrases
- Injecting malicious scripts into wallet pages
- Intercepting network requests to modify transaction data
- Trust Wallet Chrome extension breach causing $7M loss (December 2025)

### Countermeasures

#### A. Extension Popup Isolation (Primary Defense)

- **How it works**: Browser extension popups and background service workers run in an isolated context that other extensions cannot access. Sensitive operations (key entry, transaction signing) should happen ONLY in the extension popup or a dedicated extension page (`chrome-extension://` URL), never in content scripts injected into web pages.
- **Strengths**: Other extensions cannot inject content scripts into extension pages. The extension's own origin is protected by the same-origin policy.
- **Weaknesses**: The extension's own code must be trustworthy (supply chain risk).
- **Implementation**: Never render sensitive inputs in content scripts. Use `chrome.runtime.sendMessage()` for communication between content scripts and the extension popup/background.

#### B. Manifest V3 Security Model

- **How it works**: Chrome's Manifest V3 enforces stricter CSP (no remote code execution), replaces persistent background pages with service workers, and sandboxes content scripts from page scripts.
- **Strengths**: Reduces attack surface. No `eval()`, no remote script loading. Content scripts run in an isolated world separate from the page's JavaScript.
- **Weaknesses**: Research has shown bypasses are possible. Content script isolation protects the extension FROM the page, but does NOT protect the page from other extensions' content scripts.
- **Implementation**: Use Manifest V3. Set `"content_security_policy"` strictly. Minimize content script permissions. Request `"activeTab"` instead of broad host permissions.

#### C. Sandboxed iframe for Sensitive UI

- **How it works**: Render sensitive inputs (seed phrase entry, transaction confirmation) inside a cross-origin iframe served from a separate origin controlled by the wallet. The iframe's content is inaccessible to content scripts from other extensions due to same-origin policy.
- **Strengths**: Strong isolation boundary enforced by the browser. Other extensions' content scripts cannot reach into cross-origin iframes.
- **Weaknesses**: Adds latency. Requires hosting infrastructure for the iframe origin. Complex communication via `postMessage`.
- **Implementation**: Host the sensitive UI on a dedicated domain. Embed via `<iframe sandbox="allow-scripts" src="https://secure.walletdomain.com/sign">`. Validate all `postMessage` origins.

#### D. Shadow DOM (Partial Protection)

- **How it works**: Closed Shadow DOM (`attachShadow({mode: 'closed'})`) hides the internal DOM tree from external JavaScript.
- **Strengths**: Prevents casual DOM traversal. Input values inside closed Shadow DOM are not accessible via `document.querySelector()`.
- **Weaknesses**: Shadow DOM is explicitly NOT a security boundary per the spec. A determined attacker with extension-level access can still find ways to access shadow roots. It is a defense-in-depth measure, not a primary defense.
- **Implementation**: Use closed Shadow DOM for all sensitive UI elements rendered in content scripts. Combine with other measures.

#### E. Transaction Simulation and Approval

- **How it works**: Before signing, simulate the transaction and display human-readable results (token transfers, approvals, contract interactions) for user review.
- **Strengths**: Catches malicious transaction modification regardless of the attack vector. MetaMask and Phantom both implement this.
- **Implementation**: Use on-chain simulation services (Tenderly, Alchemy) or local fork simulation. Display results in the extension popup (isolated context).

---

## 4. Screen Capture Malware

### Threat Description

Malware captures screenshots or records the screen to observe seed phrases, private keys, passwords, or transaction details displayed on screen. This can defeat virtual keyboards (by seeing which keys are clicked) and clipboard isolation (by reading displayed addresses).

### Countermeasures

#### A. DRM-Based Display Protection

- **How it works**: Browsers that support Widevine, PlayReady, or FairPlay DRM can render content in protected video paths that are immune to screen capture APIs.
- **Strengths**: The OS-level screen capture APIs return black frames for DRM-protected content.
- **Weaknesses**: Only works for video content, not arbitrary HTML. Coverage is 70-80% of cases at best. Platform-specific: PlayReady+Edge on Windows, FairPlay+Safari on macOS. Not practical for wallet UI.
- **Relevance**: **Low for wallet implementations**. This is a video DRM technique, not directly applicable to form inputs.

#### B. Minimize Sensitive Display Time

- **How it works**: Show seed phrases or private keys for the minimum possible time. Use "reveal on hold" patterns where the sensitive data is only visible while a button is actively pressed. Auto-hide after a timeout.
- **Strengths**: Reduces the window of opportunity for periodic screen captures. Simple to implement.
- **Implementation**: Show seed phrase behind a blur/mask. Reveal only on `mousedown`/`touchstart`, re-hide on `mouseup`/`touchend`. Add a visible countdown timer.

#### C. Partial Display / Segmented Verification

- **How it works**: Never display the full seed phrase at once. Show words one at a time, or in small groups, requiring user interaction to advance. For verification, ask the user to confirm specific words by index rather than displaying all words.
- **Strengths**: Even if a screenshot is captured, it only reveals a portion of the seed phrase.
- **Implementation**: Show 2-3 words at a time with a "Next" button. For verification, prompt "What is word #7?" using the selection-based input described in Section 1C.

#### D. CSS-Based Anti-Screenshot Techniques

- **How it works**: Use CSS properties like `user-select: none`, high-contrast patterns that interfere with OCR, or overlay patterns that make screenshots harder to parse programmatically.
- **Strengths**: Defense-in-depth. Prevents casual copy-paste of displayed text.
- **Weaknesses**: Easily bypassed by sophisticated attackers. Not reliable as a primary defense.

#### E. Watermarking

- **How it works**: Embed invisible or semi-visible watermarks (user ID, timestamp) in sensitive displays. If a screenshot leaks, the source can be identified.
- **Strengths**: Deterrent effect. Forensic value.
- **Weaknesses**: Does not prevent capture, only aids attribution.

---

## 5. Memory Scraping

### Threat Description

Malware reads browser process memory to extract private keys, seed phrases, or decrypted wallet data. The Mars Stealer malware specifically targets crypto wallet extension memory. Browser memory management errors (use-after-free, heap buffer overflows) can also be exploited. JavaScript cannot guarantee memory zeroing -- the GC may retain copies of sensitive data indefinitely.

### Countermeasures

#### A. Web Crypto API Non-Extractable Keys

- **How it works**: Generate or import keys via `crypto.subtle.generateKey()` or `crypto.subtle.importKey()` with `extractable: false`. The key material is stored by the browser's native crypto implementation, outside the JavaScript heap. The key can be USED for signing but cannot be EXPORTED back to JavaScript.
- **Strengths**: Even if JavaScript memory is compromised, the attacker cannot extract the raw key material via the API. The browser may (but is not required to) store keys in OS-level secure storage.
- **Weaknesses**: The Web Crypto API specification "places no normative requirements on implementations regarding how cryptographic key material is stored" and "conforming user agents are not required to zeroize key material." Wallet keys (secp256k1) are not natively supported by Web Crypto API -- only P-256, P-384, P-521 curves are standard.
- **Implementation**: Use for symmetric encryption keys (AES-GCM for encrypting the vault). For ECDSA signing with secp256k1, the key must exist in JavaScript memory at some point, which is a fundamental limitation.

#### B. Minimize Key Lifetime in Memory

- **How it works**: Decrypt private keys only at the moment of signing, then immediately overwrite the memory. Use `TypedArray.fill(0)` on `Uint8Array` buffers holding key material. Set key variables to `null` to allow GC.
- **Strengths**: Reduces the time window during which keys are in cleartext memory.
- **Weaknesses**: JavaScript engines may optimize away zeroing operations. GC may have already copied the data. String values are immutable and cannot be zeroed. No guarantee of secure deallocation.
- **Implementation**: NEVER store private keys as JavaScript strings. Always use `Uint8Array` / `ArrayBuffer`. Zero immediately after use. Consider using `FinalizationRegistry` to detect when objects are GC'd. Use `WeakRef` for key handles.

#### C. Encrypted Vault with Lock Timeout

- **How it works**: Store all sensitive data (keys, seed phrases) encrypted at rest using AES-256-GCM. The encryption key is derived from the user's password via PBKDF2/Argon2. Auto-lock the wallet after inactivity, which destroys the decrypted master key from memory.
- **Strengths**: Industry standard approach used by MetaMask, Phantom, and all major wallets. Even if the encrypted vault is extracted from storage, it requires the password to decrypt.
- **Implementation**: Use Web Crypto API for AES-GCM encryption. Derive the encryption key using `crypto.subtle.deriveKey()` with PBKDF2 (600,000+ iterations) or Argon2 via WASM. Store the encrypted vault in `chrome.storage.local` (for extensions) or IndexedDB.

#### D. Hardware Wallet Delegation (Strongest Defense)

- **How it works**: The private key NEVER enters browser memory. All signing operations happen on the hardware device (Ledger, Trezor). The browser sends the unsigned transaction to the device, and receives the signature back.
- **Strengths**: Complete protection against memory scraping. The key material exists only in the hardware device's secure element.
- **Implementation**: Use Ledger's `@ledgerhq/hw-transport-webhid` or `@ledgerhq/hw-transport-webusb` packages. WebHID is preferred (better browser support). Must be triggered by user gesture. Requires HTTPS.

#### E. WebAssembly for Sensitive Operations

- **How it works**: Perform cryptographic operations in a WASM module. WASM has its own linear memory space separate from JavaScript's heap. The WASM module can zero its own memory deterministically.
- **Strengths**: WASM memory is a contiguous `ArrayBuffer` that can be explicitly zeroed. Less susceptible to JavaScript GC behavior. Harder for JavaScript-level attacks to inspect.
- **Weaknesses**: The WASM memory is still part of the browser process memory and accessible to OS-level malware. The interface between JS and WASM still involves data crossing the boundary.
- **Implementation**: Compile cryptographic libraries (e.g., libsecp256k1) to WASM. Perform all key operations inside WASM, zeroing memory immediately after use.

---

## 6. Cross-Cutting Countermeasures

### A. Hardware Wallet Integration (WebUSB/WebHID)

The strongest defense across ALL threat vectors. If the private key never enters the browser, keyloggers, clipboard hijackers, malicious extensions, screen capture, and memory scraping are all mitigated for key material.

**Technical details:**
- Ledger provides `@ledgerhq/hw-transport-webusb` and `@ledgerhq/hw-transport-webhid` npm packages
- WebHID has broader support and fewer permission issues than WebUSB
- Transport functions must be called in user-interaction context (click handler)
- Requires HTTPS
- Trezor provides `trezor-connect` SDK; also supports WebUSB, with Trezor Bridge as fallback

**Limitations:** Only protects the private key. Address display, transaction construction, and UI are still vulnerable to other attacks. Users must verify transaction details on the hardware device's display.

### B. MPC (Multi-Party Computation) Wallets

**How it works:** The private key is split into multiple "key shares" distributed across different parties (e.g., user's device, server, recovery service). Signing uses threshold signature schemes (TSS) where shares collaborate to produce a valid ECDSA/EdDSA signature WITHOUT ever reconstructing the full key.

**Advantages for browser wallets:**
- No single point of compromise -- even if browser memory is fully scraped, the attacker only gets one share
- Appears as a normal single-signature transaction on-chain (no smart contract needed)
- Works across all blockchains (unlike multisig which needs chain support)
- Key shares can be reshared/rotated without changing the public key/address
- Schnorr/FROST protocols are maturing for even better performance

**Implementations:**
- Fireblocks MPC (institutional)
- Coinbase WaaS (uses MPC)
- Web3Auth, Lit Protocol, Dfns (developer-facing MPC SDKs)
- Open-source: `blockchain-crypto-mpc`, tss-lib

**Browser-specific considerations:**
- One share runs in the browser (WASM-based computation)
- Server share(s) handle the counterpart computation
- Communication via secure WebSocket or HTTPS
- Signing latency is slightly higher (2-3 rounds of communication) but practical for interactive use

### C. WebAuthn/Passkeys with PRF Extension

**This is one of the most promising emerging approaches for browser wallets (2025-2026).**

**How it works:**
1. User creates a passkey (WebAuthn credential) on their device
2. During authentication, the PRF (Pseudo-Random Function) extension derives a deterministic 32-byte secret from the authenticator
3. This secret is used as input to HKDF to derive encryption keys (for vault decryption) or even wallet private keys
4. The secret is bound to the specific credential and authenticator -- it cannot be extracted without biometric/PIN verification

**Key properties:**
- The PRF output is deterministic for the same salt input, enabling key recovery across devices (if passkey is synced via iCloud Keychain, etc.)
- The authenticator's internal key never leaves the secure enclave
- Replaces seed phrases entirely -- Breez SDK has implemented this for Lightning wallets
- Dashlane uses PRF to replace master passwords for vault decryption
- Browser support: Chrome, Safari, Firefox (as of 2026). Not yet built into Windows Hello; requires an authenticator like a password manager there.

**For wallet implementation:**
- Use PRF to derive the master encryption key for the wallet vault
- Optionally derive wallet private keys deterministically from PRF output + chain-specific derivation paths
- Eliminates the need for users to ever see, type, or store a seed phrase
- Biometric authentication protects against keyloggers, clipboard attacks, and casual physical access

### D. Trusted Execution Environments (TEE)

**Relevance to browser wallets: Indirect but growing.**

TEEs (Intel SGX, AMD SEV, ARM TrustZone) provide hardware-isolated enclaves where code and data are protected from the OS itself. In the Web3 space:
- Secret Network and Oasis Network use Intel SGX for privacy-preserving computation
- Server-side TEE can protect the MPC server share
- Gartner predicts 50% of large orgs will adopt privacy-enhancing computation by 2026
- No direct browser API for TEE access, but server-side TEE strengthens MPC architectures

**Practical browser relevance:**
- Passkey authenticators (Secure Enclave, TPM) ARE a form of TEE that browsers can leverage via WebAuthn
- Server-side MPC shares can run inside SGX enclaves for additional protection
- Future: WebGPU compute shaders may eventually provide some isolation guarantees, but this is speculative

### E. Zero-Knowledge Proofs (ZKP)

**Application to wallet security:**
- Client-side ZK proof generation (using SnarkJS or similar) can prove transaction validity without revealing private inputs
- Aleo model: users execute transactions locally, generate ZK proofs, and only submit proofs to the network
- Can enable "prove you own an address without revealing the private key" flows
- FeatherWallet demonstrates lightweight mobile ZKP wallet using zk-SNARKs
- Practical for privacy, less directly applicable to key protection against local malware

---

## 7. Cutting-Edge Approaches

### A. Passkey-Native Smart Wallets (Account Abstraction + WebAuthn)

Smart contract wallets (ERC-4337) where the on-chain verifier validates WebAuthn signatures directly. The user's passkey IS the wallet key. No seed phrase, no browser-stored private key. Transaction signing happens in the device's secure enclave. Projects: Clave, ZeroDev, Safe{Wallet}.

### B. Session Keys with Limited Permissions

Grant dApps temporary, scoped signing keys that can only perform specific operations (e.g., "swap up to 100 USDC on Uniswap for the next 1 hour"). Even if compromised, damage is bounded. Implemented via account abstraction or smart contract wallets.

### C. Threshold Decryption for Seed Phrase Backup

Instead of showing the seed phrase in plaintext, split it using Shamir's Secret Sharing and distribute shares to multiple trusted parties or storage locations. Reconstruction requires a threshold (e.g., 3-of-5 shares). Reduces screen capture and memory scraping risk during backup.

### D. Decoy/Honeypot Addresses

Monitor for clipboard hijacking by maintaining a list of expected destination addresses. If the pasted address does not match, trigger an alert. Optionally include "canary" addresses that, if funds are sent to them, indicate compromise.

### E. Browser Extension Behavior Monitoring

Analyze installed extensions for suspicious behaviors: excessive permissions, DOM manipulation patterns, network requests to unknown domains. Some enterprise browsers (Island) provide this. Could be implemented as a pre-check in the wallet extension.

---

## 8. Implementation Priority Matrix

| Countermeasure | Keylogger | Clipboard | Extensions | Screen Cap | Memory | Effort | Priority |
|---|---|---|---|---|---|---|---|
| **WebAuthn/Passkeys + PRF** | HIGH | N/A | HIGH | MEDIUM | HIGH | Medium | **P0** |
| **Hardware wallet (WebHID)** | HIGH | N/A | HIGH | MEDIUM | HIGH | Medium | **P0** |
| **Extension popup isolation** | N/A | N/A | HIGH | N/A | N/A | Low | **P0** |
| **Encrypted vault + auto-lock** | N/A | N/A | MEDIUM | N/A | HIGH | Low | **P0** |
| **Transaction simulation** | N/A | HIGH | HIGH | N/A | N/A | Medium | **P1** |
| **MPC key splitting** | MEDIUM | N/A | HIGH | N/A | HIGH | High | **P1** |
| **Virtual keyboard (randomized)** | HIGH | N/A | LOW | MEDIUM | N/A | Medium | **P1** |
| **Address verification UI** | N/A | HIGH | MEDIUM | N/A | N/A | Low | **P1** |
| **QR code addressing** | N/A | HIGH | N/A | N/A | N/A | Low | **P1** |
| **Shadow DOM for sensitive UI** | N/A | N/A | LOW | N/A | N/A | Low | **P2** |
| **Sandboxed cross-origin iframe** | MEDIUM | N/A | HIGH | N/A | N/A | High | **P2** |
| **WASM crypto operations** | N/A | N/A | N/A | N/A | MEDIUM | Medium | **P2** |
| **Minimize display time** | N/A | N/A | N/A | HIGH | N/A | Low | **P2** |
| **Segmented seed display** | N/A | N/A | N/A | HIGH | N/A | Low | **P2** |
| **Minimize key lifetime** | N/A | N/A | N/A | N/A | MEDIUM | Low | **P2** |
| **DRM display protection** | N/A | N/A | N/A | LOW | N/A | High | **P3** |
| **CSS anti-screenshot** | N/A | N/A | N/A | LOW | N/A | Low | **P3** |

**Priority Legend:**
- **P0**: Must-have. Foundational security measures.
- **P1**: Should-have. Significant security improvement.
- **P2**: Nice-to-have. Defense-in-depth.
- **P3**: Low impact or impractical. Consider only if other priorities are met.

---

## 9. Sources

- [New Torg Grabber infostealer malware targets 728 crypto wallets](https://www.bleepingcomputer.com/news/security/new-torg-grabber-infostealer-malware-targets-728-crypto-wallets/)
- [Clipboard Hijacking Attacks: How to Prevent Them - Trust Wallet](https://trustwallet.com/blog/security/clipboard-hijacking-attacks-how-to-prevent-them)
- [ClipXDaemon: Autonomous X11 Clipboard Hijacker - Cyble](https://cyble.com/blog/clipxdaemon-autonomous-x11-clipboard-hijacker/)
- [Top Crypto Security Risks in 2026 - CoolWallet](https://www.coolwallet.io/blogs/blog/crypto-security-risks-2026)
- [Is MetaMask Safe & Legit? - Coin Bureau](https://coinbureau.com/analysis/is-metamask-safe-and-legit)
- [MetaMask, Phantom and Other Browser Wallets Patch Security Vulnerability - CoinDesk](https://www.coindesk.com/tech/2022/06/15/metamask-phantom-and-other-browser-wallets-patch-security-vulnerability)
- [CryptoKey: extractable property - MDN](https://developer.mozilla.org/en-US/docs/Web/API/CryptoKey/extractable)
- [SubtleCrypto - MDN](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)
- [Web Cryptography API Level 2 - W3C](https://w3c.github.io/webcrypto/)
- [Application Layer Encryption with Web Crypto API - TrustedSec](https://trustedsec.com/blog/application-layer-encryption-with-web-crypto-api)
- [Virtual Keyboard to Protect Passwords - Oxynger](https://www.oxynger.com/)
- [About On-Screen Keyboard - Kaspersky](https://support.kaspersky.com/KIS/2020/en-us/70895.htm)
- [Improve Extension Security - Chrome Developers](https://developer.chrome.com/docs/extensions/develop/migrate/improve-security)
- [Manifest - Sandbox - Chrome Developers](https://developer.chrome.com/docs/extensions/reference/manifest/sandbox)
- [Breaking Out of the Chrome/WebExtension Sandbox - Intoli](https://intoli.com/blog/sandbox-breakout/)
- [How to bypass Google Manifest v3 - ResearchGate](https://www.researchgate.net/publication/360877439_How_to_bypass_Google_Manifest_v3_to_publish_malicious_extensions_on_Chrome_Web_Store)
- [MPC Wallets: A Complete Technical Guide - Stackup](https://www.stackup.fi/resources/mpc-wallets-a-complete-technical-guide)
- [MPC Wallets: Complete Developer Guide 2025 - Alchemy](https://www.alchemy.com/overviews/what-is-a-multi-party-computation-mpc-wallet)
- [A Deep Dive into TSS-MPC - Dynamic](https://www.dynamic.xyz/blog/a-deep-dive-into-tss-mpc)
- [Passkeys & WebAuthn PRF for End-to-End Encryption - Corbado](https://www.corbado.com/blog/passkeys-prf-webauthn)
- [What Is a Passkey? Breaking Down Authentication in Crypto Wallets - Incrypted](https://incrypted.com/en/passkeys-vs-passwords-and-2fa-a-new-era-of-crypto-wallet-security/)
- [The Passkey Paradigm Shift - Cryptonium](https://cryptonium.cloud/articles/passkey-paradigm-shift-death-of-seed-phrases-unlocked-crypto-next-billion-users-2026)
- [Frictionless Crypto Sign-In with WebAuthn Passkeys - PasskeyWallets](https://passkeywallets.com/2026/02/04/frictionless-crypto-sign-in-with-webauthn-passkeys-for-everyday-users/)
- [PRF Extension - Yubico](https://developers.yubico.com/WebAuthn/Concepts/PRF_Extension/)
- [PRF WebAuthn and its role in passkeys - Bitwarden](https://bitwarden.com/blog/prf-webauthn-and-its-role-in-passkeys/)
- [Breez SDK Integrates Passkey Login - Bitcoin News](https://news.bitcoin.com/breez-sdk-integrates-passkey-login-to-eliminate-traditional-seed-phrase-barriers/)
- [Shadow DOM vs. iframes - HackerNoon](https://hackernoon.com/shadow-dom-vs-iframes-which-one-actually-works)
- [Open Closed Shadow DOM - Chrome Extension Security](http://extensions.neplox.security/Attacks/Shadow/)
- [Shadow DOM Guide: Security & Use Cases 2025 - CybersGuards](https://cybersguards.com/shadow-dom/)
- [Web USB/HID - Ledger Developer Portal](https://developers.ledger.com/docs/device-interaction/ledgerjs/integration/web-application/web-hid-usb)
- [DOM-based Extension Clickjacking - Marek Toth](https://marektoth.com/blog/dom-based-extension-clickjacking/)
- [How browser extensions expose crypto to a fatal design flaw - CryptoSlate](https://cryptoslate.com/how-browser-extensions-expose-your-crypto-to-a-fatal-design-flaw-that-the-industry-ignored-bleeding-713m-in-2025/)
- [Trust Wallet Chrome Extension Breach - The Hacker News](https://thehackernews.com/2025/12/trust-wallet-chrome-extension-bug.html)
- [Trusted Execution Environments in Web3 - Metaschool](https://metaschool.so/articles/trusted-execution-environments-tees)
- [Screen Capture Prevention - Gumlet](https://docs.gumlet.com/reference/screen-capture-prevention)
- [FeatherWallet: Lightweight Mobile Cryptocurrency Wallet Using zk-SNARKs](https://arxiv.org/html/2503.22717)
- [Crypto Hacks 2026: $2.1B Stolen - MEXC](https://blog.mexc.com/news/crypto-hacks-2026-2-1b-stolen-complete-protection-guide/)
- [WebAuthn Passkeys with PRF Extension for Stateless Private Keys - Polkadot Forum](https://forum.polkadot.network/t/webauthn-passkeys-with-prf-extension-for-stateless-private-keys/14368)
