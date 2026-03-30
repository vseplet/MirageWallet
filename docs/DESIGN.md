# MirageWallet -- Design Document

> Браузерный криптокошелек, работающий как **обычная веб-страница** (не расширение),
> с фокусом на защиту от локальных угроз.
>
> **Ограничения:**
> - Никакого бэкенда / сервера. Только клиентский код + блокчейн
> - Никакого расширения. Кошелек = веб-страница в браузере
> - Враг — это другие расширения, кейлоггеры, clipboard-снифферы, malware на машине

---

## Жесткая правда: веб-страница vs расширение

Обычная веб-страница — **самый уязвимый контекст** в браузере:

| Что может вредоносное расширение | Extension popup | Веб-страница |
|----------------------------------|:-:|:-:|
| Читать/модифицировать DOM | нет | **да** |
| Перехватывать JS-события (keydown, click) | нет | **да** |
| Инжектировать скрипты | нет | **да** |
| Читать/подменять сетевые запросы (webRequest) | нет | **да** |
| Читать IndexedDB / localStorage | нет | **да** |
| Перехватывать WebAuthn ceremony | нет | **частично** |
| Модифицировать WASM memory | нет | **да** (через JS-обертку) |

Это значит: **на уровне веб-страницы мы НЕ можем надежно защитить приватный ключ от расширения, которое целенаправленно атакует наш сайт.** Это фундаментальное ограничение модели безопасности браузера.

Поэтому наша стратегия: **минимизировать то, что можно украсть, и максимально затруднить атаку по каждому вектору.**

---

## Модель угроз

| # | Угроза | Контекст веб-страницы | Критичность |
|---|--------|----------------------|-------------|
| T1 | Keylogger | JS keydown-листенеры от расширений + OS-level хуки | Высокая |
| T2 | Clipboard hijacker | Расширения могут читать/подменять clipboard; OS-level malware | Высокая |
| T3 | Malicious extension | **Полный доступ к DOM, JS, сети, storage** нашей страницы | **Критическая** |
| T4 | Screen capture | Снятие скриншотов / запись экрана | Средняя |
| T5 | Memory scraping | Чтение памяти процесса браузера | Высокая |

---

## Ключевые архитектурные решения

### 1. Passkey-First: ключи не покидают Secure Enclave

**Идея:** WebAuthn Passkeys + PRF extension — единственный надежный примитив, который расширения не могут полностью скомпрометировать. PRF-вызов проходит через нативный браузерный API, его невозможно перехватить через content script.

- PRF генерирует детерминированный 32-байтный секрет из Secure Enclave
- Этот секрет используется для расшифровки vault (AES-256-GCM)
- Деривация ключей кошелька: `PRF output -> HKDF -> BIP-32 path -> private key`

**Почему это работает против расширений (T3):**
- WebAuthn ceremony проходит через браузерный UI (не DOM) — расширение не может подменить challenge
- PRF output привязан к `rpId` (наш домен) — расширение не может запросить его для другого origin
- Биометрика/PIN проверяется на уровне ОС, вне досягаемости расширений

**Ограничение:** Расширение может перехватить PRF output ПОСЛЕ того, как он вернулся в JS-контекст страницы. Поэтому PRF output должен сразу уходить в WASM и не задерживаться в JS.

### 2. WASM Crypto Vault — изолированная крепость

**Идея:** Вся работа с ключами происходит ВНУТРИ WebAssembly модуля. JS-код никогда не видит приватные ключи, seed, PRF-output в расшифрованном виде.

```
JS-мир (доступен расширениям)         WASM-мир (труднодоступен)
┌─────────────────────────┐           ┌─────────────────────────┐
│                         │           │                         │
│  UI, формы, кнопки      │──────────>│  PRF output приём       │
│                         │  encrypted│  Key derivation         │
│  Получает только:       │<──────────│  Transaction signing    │
│  - подписанную tx       │  signature│  Vault encrypt/decrypt  │
│  - публичные адреса     │           │  Secure memory zeroing  │
│  - баланс/статус        │           │                         │
└─────────────────────────┘           └─────────────────────────┘
```

**Почему это помогает против расширений (T3):**
- Расширение видит JS-heap, но WASM linear memory — это отдельный `ArrayBuffer`
- Расширение не может вызвать экспортированные WASM-функции напрямую, только через JS-обертку
- **Ключевой трюк:** Обфускация/минимизация JS-обертки + integrity check при загрузке WASM модуля
- WASM память зануляется детерминированно после каждой операции

**Ограничение:** Если расширение подменит JS-обертку до загрузки WASM — оно получит контроль. Поэтому нужен **integrity check** (см. раздел 3).

### 3. Script Integrity + CSP Hardening

**Идея:** Максимально затруднить инъекцию и подмену кода на странице.

**Content Security Policy:**
```
Content-Security-Policy:
  default-src 'none';
  script-src 'self' 'wasm-unsafe-eval';
  style-src 'self';
  connect-src https://*.infura.io https://*.alchemy.com;
  img-src 'self' data:;
  frame-src 'none';
```

- `script-src 'self'` — никаких inline-скриптов, никаких внешних скриптов
- `'wasm-unsafe-eval'` — разрешает WASM, но не `eval()`
- `frame-src 'none'` — нельзя встроить нас в iframe (clickjacking)

**WASM Integrity Check:**
- WASM-модуль загружается с SRI (Subresource Integrity) hash
- При старте WASM-модуль вычисляет hash самого себя и сравнивает с зашитым значением
- Если hash не совпадает — отказ работы

**Ограничение:** Расширение с `webRequest` / `declarativeNetRequest` может подменить ответ сервера ДО применения CSP. Расширение с `scripting` API может инжектировать код в "main world" страницы, обходя CSP. **Это неустранимое ограничение веб-страницы.**

### 4. Encrypted Vault + Aggressive Auto-Lock

**Идея:** Все данные кошелька зашифрованы AES-256-GCM в WASM. Vault хранится в IndexedDB в зашифрованном виде. Ключ шифрования деривируется из PRF output и существует только в WASM-памяти.

Auto-lock:
- Через N секунд неактивности (default: 60с)
- При `visibilitychange` (вкладка скрыта)
- При `beforeunload`
- Lock = зануление WASM-памяти с ключами

**Что это дает:**
- Зашифрованный vault в IndexedDB бесполезен без PRF (T3, T5)
- Окно, когда ключи расшифрованы, минимально
- Расширение может прочитать IndexedDB, но увидит только ciphertext

### 5. Zero-Keyboard Input

**Идея:** Полное исключение клавиатурного ввода для чувствительных данных.

- **Randomized virtual keyboard** — рендерится через Canvas API (не DOM-элементы!), клики определяются по координатам внутри canvas. Расширение видит `<canvas>`, но не знает расположение кнопок.
- **Drag-and-drop word tiles** для seed-фразы при импорте — через Canvas или pointer events на абстрактных элементах
- **QR-code scanner** (через `getUserMedia`) для ввода адресов — данные идут напрямую из камеры в WASM, минуя DOM

**Почему Canvas, а не DOM:**
- DOM-элементы (кнопки, инпуты) полностью видны расширениям через `querySelector`
- Canvas — это пиксели. Расширение видит `<canvas>`, но не может определить, что на нем нарисовано, без screen capture
- Координаты кликов внутри canvas бессмысленны без знания layout (который рандомизируется)

### 6. Transaction Verification через отдельный канал

**Идея:** Главная проблема веб-страницы — расширение может подменить то, что видит пользователь (показать адрес A, а подписать транзакцию на адрес B). Нужен **out-of-band verification**.

Варианты:
- **Hardware wallet (WebHID/WebUSB):** Транзакция показывается на экране устройства. Пользователь верифицирует на экране Ledger/Trezor, а не в браузере. Самая надежная защита.
- **Companion mobile app (через QR):** Страница показывает QR с деталями транзакции. Пользователь сканирует телефоном, видит детали, подтверждает. Без сервера — через подпись транзакции на телефоне (вторая share ключа).
- **Visual address fingerprint:** Генерация уникальной визуальной иконки (identicon/blockies) для каждого адреса. Подмененный адрес будет иметь другую иконку — пользователь заметит.

### 7. Address Guard

- Хеширование и сравнение адреса ДО и ПОСЛЕ вставки из clipboard
- Подсветка первых 6 и последних 4 символов адреса крупным шрифтом
- Whitelist сохраненных адресов (зашифрован в vault)
- При совпадении формата но несовпадении значения — красное предупреждение + задержка 10с

### 8. Минимизация отображения секретов

- Seed-фразы при импорте: по 1 слову за раз, через canvas (не DOM-текст)
- "Reveal on hold" через canvas — данные видимы только при удержании
- Auto-blur через 3 секунды
- Приватные ключи НИКОГДА не отображаются — только export в зашифрованный файл

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│  Веб-страница (https://miragewallet.app)                       │
│                                                             │
│  ┌─────────────────────┐  ┌──────────────────────────────┐  │
│  │ UI Layer            │  │ Canvas Secure Input          │  │
│  │ (React/Solid)       │  │ - Virtual keyboard           │  │
│  │                     │  │ - Address display             │  │
│  │ Показывает только:  │  │ - Seed word tiles            │  │
│  │ - балансы           │  │ - QR scanner (getUserMedia)  │  │
│  │ - историю           │  │                              │  │
│  │ - публичные адреса  │  │ Рисует на <canvas>,          │  │
│  │                     │  │ не в DOM                     │  │
│  └────────┬────────────┘  └──────────────┬───────────────┘  │
│           │                              │                  │
│  ┌────────v──────────────────────────────v───────────────┐  │
│  │ JS Bridge (минимальный, обфусцированный)              │  │
│  │ - Передает encrypted PRF output в WASM               │  │
│  │ - Передает unsigned tx bytes в WASM                   │  │
│  │ - Получает signature bytes из WASM                    │  │
│  │ - Integrity check при загрузке WASM                   │  │
│  └────────┬─────────────────────────────────────────────┘  │
│           │                                                 │
│  ┌────────v─────────────────────────────────────────────┐  │
│  │ WASM Crypto Engine (libsecp256k1 + libsodium)        │  │
│  │ - PRF output -> HKDF -> key derivation               │  │
│  │ - AES-256-GCM vault encrypt/decrypt                  │  │
│  │ - secp256k1 ECDSA signing                            │  │
│  │ - Shamir split/reconstruct                           │  │
│  │ - Deterministic memory zeroing                       │  │
│  │                                                      │  │
│  │ Приватные ключи НИКОГДА не покидают этот модуль      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Storage: IndexedDB (encrypted vault only)                  │
│  Network: Public RPC (Infura/Alchemy/custom node)           │
│  Auth: WebAuthn/Passkeys (PRF extension)                    │
│  Verification: Hardware wallet (WebHID) / QR companion      │
└─────────────────────────────────────────────────────────────┘
```

---

## Матрица покрытия угроз

| Решение | T1 Keylog | T2 Clipboard | T3 Extension | T4 Screen | T5 Memory |
|---------|-----------|-------------|--------------|-----------|-----------|
| Passkey/PRF | +++ | - | ++ | + | +++ |
| WASM isolation | - | - | ++ | - | ++ |
| CSP + integrity | - | - | + | - | - |
| Encrypted vault | - | - | ++ | - | ++ |
| Canvas input | +++ | +++ | ++ | + | - |
| HW wallet verify | - | ++ | +++ | - | +++ |
| Address Guard | - | +++ | + | - | - |
| Min display | - | - | - | +++ | - |

**Обратите внимание:** Против T3 (malicious extension) ни одно решение не дает `+++` для веб-страницы. Это фундаментальное ограничение. Только hardware wallet дает `+++`, потому что выносит верификацию за пределы браузера.

---

## Уровни безопасности (Security Tiers)

### Tier 1 -- Basic (для мелких сумм)
- Passkey аутентификация + PRF для vault
- WASM crypto engine (ключи не в JS)
- Canvas-based virtual keyboard
- Address Guard
- Encrypted vault + auto-lock (60с)

### Tier 2 -- Standard
- Все из Tier 1
- Shamir 2-of-2 (IndexedDB + encrypted file backup)
- QR-сканер для адресов (без clipboard)
- Transaction simulation через `eth_call`
- Auto-lock 30с

### Tier 3 -- Hardware
- Все из Tier 2
- **Hardware wallet обязателен** для подписи транзакций
- Приватный ключ НЕ существует в браузере вообще
- Верификация транзакции на экране устройства
- Единственный tier, дающий реальную защиту от целенаправленной атаки расширения

---

## Рекомендация для пользователей

```
Сколько у вас крипты?          Рекомендуемый tier
─────────────────────          ──────────────────
< $500                         Tier 1 (Basic)
$500 - $10,000                 Tier 2 (Standard)
> $10,000                      Tier 3 (Hardware) — ОБЯЗАТЕЛЬНО
> $50,000                      Не используйте веб-кошелек.
                               Используйте hardware wallet + desktop app.
```

---

## Открытые вопросы

1. **Passkey recovery:** Если устройство потеряно — cloud-synced passkeys? Social recovery через smart contract? Encrypted backup file?
2. **secp256k1 vs P-256:** WebAuthn использует P-256, блокчейны — secp256k1. Для EVM — ERC-4337 с on-chain P-256 верификатором. Для других чейнов — PRF используется только для vault encryption, не для signing напрямую.
3. **PRF browser support:** Chrome и Safari поддерживают. Firefox — частично. Fallback: пароль + Argon2, но это деградация безопасности.
4. **Canvas fingerprinting:** Рисование на canvas может быть использовано для fingerprinting. Нужно балансировать.
5. **WASM integrity в runtime:** Расширение теоретически может подменить `WebAssembly.instantiate`. Нужен ли нам защитный wrapper? Насколько это реалистичная атака?
6. **RPC trust:** Публичные RPC могут вернуть неправильные данные (баланс, nonce). Верификация через несколько RPC? Свой light client в WASM (helios)?
7. **Offline-first:** Можно ли подписывать транзакции офлайн (подготовить на одной странице, подписать на air-gapped машине, broadcast через другую)?

---

## Честная оценка: чего мы НЕ можем защитить

| Сценарий | Защита | Комментарий |
|----------|--------|-------------|
| Расширение подменяет JS до загрузки WASM | **Нет** | Расширение с `scripting.executeScript` может модифицировать `WebAssembly.instantiate` |
| Расширение модифицирует DOM для показа фейковых адресов | **Частичная** | Canvas помогает, но не гарантирует |
| Расширение перехватывает fetch/XHR к RPC | **Нет** | `webRequest` API дает полный контроль над сетью страницы |
| OS-level keylogger + screen capture | **Частичная** | Canvas keyboard помогает, но sophisticated malware все равно победит |
| Физический доступ к разблокированной машине | **Нет** | Все ставки сняты |

**Вывод: для серьезных сумм — только hardware wallet (Tier 3). Наш кошелек честно предупреждает об этом.**

---

## Ссылки

- [WebAuthn PRF Extension -- Yubico](https://developers.yubico.com/WebAuthn/Concepts/PRF_Extension/)
- [Shamir's Secret Sharing -- Wikipedia](https://en.wikipedia.org/wiki/Shamir%27s_secret_sharing)
- [Ledger WebHID Integration](https://developers.ledger.com/docs/device-interaction/ledgerjs/integration/web-application/web-hid-usb)
- [ERC-4337 Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [DOM-based Extension Clickjacking](https://marektoth.com/blog/dom-based-extension-clickjacking/)
- [Passkey Paradigm Shift in Crypto](https://cryptonium.cloud/articles/passkey-paradigm-shift-death-of-seed-phrases-unlocked-crypto-next-billion-users-2026)
- [Helios Light Client](https://github.com/a16z/helios)
- [Canvas API -- MDN](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
