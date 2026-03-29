import { Container, Graphics, Text, TextStyle } from "pixi.js";
import {
  COLORS,
  FONT_FAMILY,
  POPUP_WIDTH,
  POPUP_HEIGHT,
  PADDING,
  VK_COLS,
  VK_KEY_HEIGHT,
  VK_GAP,
  VK_DISPLAY_HEIGHT,
  VK_MAX_LENGTH,
  VK_DISPLAY_DOTS,
  VK_KEY_RADIUS,
  VK_DISPLAY_RADIUS,
  S,
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

  c.on("pointerout", () => draw(color));
  c.on("pointerup", () => onTap());

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

  const charsContainer = new Container();
  charsContainer.x = 12;
  charsContainer.y = 0;
  container.addChild(charsContainer);

  container.x = PADDING;
  container.y = y;

  // Pre-fill with VK_MAX_LENGTH dots — length never changes
  const charSlots: { text: Text; container: Container }[] = [];
  const dot = "\u25CF";
  const charW = Math.floor((GRID_W - 24) / VK_DISPLAY_DOTS);

  for (let i = 0; i < VK_DISPLAY_DOTS; i++) {
    const cc = new Container();
    cc.eventMode = "static";
    cc.cursor = "default";
    cc.x = i * charW;

    const ct = new Text({
      text: dot,
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        fill: COLORS.textMuted,
      }),
    });
    ct.anchor.set(0, 0.5);
    ct.y = VK_DISPLAY_HEIGHT / 2;
    cc.addChild(ct);

    const hit = new Graphics();
    hit.rect(0, 0, charW, VK_DISPLAY_HEIGHT);
    hit.fill({ color: 0x000000, alpha: 0.001 });
    cc.addChild(hit);

    charSlots.push({ text: ct, container: cc });
    charsContainer.addChild(cc);
  }

  let currentValue = "";

  return {
    container,
    update: (val: string) => {
      currentValue = val;
      // Remove old hover listeners and re-attach with updated value
      for (let i = 0; i < VK_DISPLAY_DOTS; i++) {
        const slot = charSlots[i]!;
        slot.text.text = dot;
        slot.text.style.fill = COLORS.textMuted;
        slot.container.removeAllListeners();
        slot.container.eventMode = "static";

        const idx = i;
        slot.container.on("pointerover", () => {
          if (idx < currentValue.length) {
            slot.text.text = currentValue[idx]!;
            slot.text.style.fill = COLORS.text;
          }
        });
        slot.container.on("pointerout", () => {
          slot.text.text = dot;
          slot.text.style.fill = COLORS.textMuted;
        });
      }
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

  function maybeShuffle() {
    if (Math.random() < 0.5) renderKeys();
  }

  function onChar(ch: string) {
    if (value.length >= VK_MAX_LENGTH) return;
    value += ch;
    display.update(value);
    opts.onChange?.(value);
    maybeShuffle();
  }

  function onBackspace() {
    if (value.length === 0) return;
    value = value.slice(0, -1);
    display.update(value);
    opts.onChange?.(value);
    maybeShuffle();
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

    container.addChild(keysContainer);
  }

  renderKeys();

  // ── Fixed bottom buttons ──────────────────────────────

  const bottomBtnY = POPUP_HEIGHT - PADDING - VK_KEY_HEIGHT;
  const halfW = Math.floor((GRID_W - VK_GAP) / 2);

  const backspace = createKey(S.del, halfW, VK_KEY_HEIGHT, onBackspace, COLORS.danger);
  backspace.x = PADDING;
  backspace.y = bottomBtnY;
  container.addChild(backspace);

  const doneBtn = createKey(S.vkDone, halfW, VK_KEY_HEIGHT, onDone, COLORS.accent);
  doneBtn.x = PADDING + halfW + VK_GAP;
  doneBtn.y = bottomBtnY;
  container.addChild(doneBtn);

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
