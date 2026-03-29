# MirageWallet

Chrome extension (Manifest V3) with PixiJS canvas UI.

## Prerequisites

- [Bun](https://bun.sh/) v1.0+
- Google Chrome / Chromium

## Setup

```bash
# Install dependencies
bun install

# Build the extension
bun run build
```

The built extension will be in the `dist/` directory.

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `dist/` folder from this project
5. Click the puzzle icon in Chrome toolbar and pin **MirageWallet**
6. Click the MirageWallet icon -- a popup with a PixiJS button will appear

## Development

```bash
# Watch mode -- rebuilds on file changes
bun run dev
```

After each rebuild, go to `chrome://extensions` and click the reload button on the MirageWallet card.

## Project Structure

```
MirageWallet/
  manifest.json      - Chrome extension manifest (MV3)
  popup.html         - Popup entry point
  src/
    popup.ts         - PixiJS application with interactive button
  vite.config.ts     - Vite build config
  scripts/
    copy-assets.ts   - Copies manifest + icons to dist/
  icons/             - Extension icons
  dist/              - Build output (load this in Chrome)
```
