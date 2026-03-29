import { Container, Graphics, Text, TextStyle } from "pixi.js";
import {
  COLORS,
  FONT_FAMILY,
  POPUP_WIDTH,
  PADDING,
  VK_COLS,
  VK_KEY_HEIGHT,
  VK_GAP,
  VK_DISPLAY_HEIGHT,
  VK_MAX_LENGTH,
  VK_KEY_RADIUS,
  VK_DISPLAY_RADIUS,
} from "@/config";

// ── Types ───────────────────────────────────────────────

export interface VirtualKeyboardOpts {
  y: number;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
}

export interface VirtualKeyboard {
  container: Container;
  getValue: () => string;
  clear: () => void;
  shuffle: () => void;
  destroy: () => void;
}

// ── Characters ──────────────────────────────────────────

const CHARS = "abcdefghijklmnopqrstuvwxyz0123456789".split("");

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

// ── Computed layout ─────────────────────────────────────

const GRID_W = POPUP_WIDTH - PADDING * 2;
const KEY_W = Math.floor((GRID_W - VK_GAP * (VK_COLS - 1)) / VK_COLS);

// ── Key button ──────────────────────────────────────────

function createKey(
  label: string,
  w: number,
  h: number,
  onTap: () => void,
  color: number = COLORS.inputBg,
  hideLabel = false,
): Container {
  const c = new Container();
  c.eventMode = "static";
  c.cursor = "pointer";

  const bg = new Graphics();
  const draw = (col: number) => {
    bg.clear();
    bg.roundRect(0, 0, w, h, VK_KEY_RADIUS);
    bg.fill(col);
  };
  draw(color);

  const text = new Text({
    text: hideLabel ? "\u2022" : label,
    style: new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: label.length > 2 ? 13 : 18,
      fontWeight: "bold",
      fill: "#ffffff",
    }),
  });
  text.anchor.set(0.5);
  text.x = w / 2;
  text.y = h / 2;

  c.addChild(bg);
  c.addChild(text);

  c.on("pointerover", () => {
    if (hideLabel) text.text = label;
  });
  c.on("pointerout", () => {
    if (hideLabel) text.text = "\u2022";
    draw(color);
  });
  c.on("pointerdown", () => draw(COLORS.accentPress));
  c.on("pointerup", () => {
    draw(color);
    onTap();
  });

  return c;
}

// ── Display field ───────────────────────────────────────

function createDisplay(y: number): { container: Container; update: (val: string) => void } {
  const container = new Container();

  const bg = new Graphics();
  bg.roundRect(0, 0, GRID_W, VK_DISPLAY_HEIGHT, VK_DISPLAY_RADIUS);
  bg.fill(COLORS.inputBg);
  bg.stroke({ width: 1, color: COLORS.inputBorder });
  container.addChild(bg);

  const text = new Text({
    text: "",
    style: new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: 20,
      fill: "#ffffff",
      letterSpacing: 3,
    }),
  });
  text.anchor.set(0, 0.5);
  text.x = 14;
  text.y = VK_DISPLAY_HEIGHT / 2;
  container.addChild(text);

  container.x = PADDING;
  container.y = y;

  return {
    container,
    update: (val: string) => {
      text.text = "\u25CF".repeat(val.length);
    },
  };
}

// ── Virtual Keyboard ────────────────────────────────────

export function createVirtualKeyboard(opts: VirtualKeyboardOpts): VirtualKeyboard {
  const container = new Container();
  let value = "";
  let keysContainer: Container | null = null;

  const display = createDisplay(opts.y);
  container.addChild(display.container);

  const gridY = opts.y + VK_DISPLAY_HEIGHT + VK_GAP * 2;

  function onChar(ch: string) {
    if (value.length >= VK_MAX_LENGTH) return;
    value += ch;
    display.update(value);
    opts.onChange?.(value);
  }

  function onBackspace() {
    if (value.length === 0) return;
    value = value.slice(0, -1);
    display.update(value);
    opts.onChange?.(value);
  }

  function onDone() {
    opts.onSubmit?.(value);
  }

  function renderKeys() {
    if (keysContainer) {
      container.removeChild(keysContainer);
      keysContainer.destroy({ children: true });
    }

    keysContainer = new Container();
    keysContainer.x = PADDING;
    keysContainer.y = gridY;

    const shuffled = shuffleArray(CHARS);

    for (let i = 0; i < shuffled.length; i++) {
      const col = i % VK_COLS;
      const row = Math.floor(i / VK_COLS);
      const ch = shuffled[i]!;

      const isDigit = ch >= "0" && ch <= "9";
      const isVowel = "aeiou".includes(ch);
      const keyColor = isDigit ? COLORS.keyDigit : isVowel ? COLORS.keyVowel : COLORS.keyConsonant;
      const key = createKey(ch, KEY_W, VK_KEY_HEIGHT, () => onChar(ch), keyColor);
      key.x = col * (KEY_W + VK_GAP);
      key.y = row * (VK_KEY_HEIGHT + VK_GAP);
      keysContainer.addChild(key);
    }

    // Bottom row: Del + Done — full width, split in half
    const totalRows = Math.ceil(shuffled.length / VK_COLS);
    const bottomY = totalRows * (VK_KEY_HEIGHT + VK_GAP);
    const halfW = Math.floor((GRID_W - VK_GAP) / 2);

    const backspace = createKey("\u2190 Del", halfW, VK_KEY_HEIGHT, onBackspace, COLORS.danger);
    backspace.x = 0;
    backspace.y = bottomY;
    keysContainer.addChild(backspace);

    const done = createKey("Done", halfW, VK_KEY_HEIGHT, onDone, COLORS.accent);
    done.x = halfW + VK_GAP;
    done.y = bottomY;
    keysContainer.addChild(done);

    container.addChild(keysContainer);
  }

  renderKeys();

  return {
    container,
    getValue: () => value,
    clear: () => {
      value = "";
      display.update(value);
    },
    shuffle: () => renderKeys(),
    destroy: () => {
      container.destroy({ children: true });
    },
  };
}
