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

  return {
    container,
    update: (val: string) => {
      while (charsContainer.children.length) {
        charsContainer.removeChildAt(0);
      }
      for (let i = 0; i < val.length; i++) {
        const ch = val[i]!;
        const cc = new Container();
        cc.eventMode = "static";
        cc.cursor = "default";

        const ct = new Text({
          text: "\u25CF",
          style: new TextStyle({
            fontFamily: FONT_FAMILY,
            fontSize: 20,
            fill: "#ffffff",
          }),
        });
        ct.anchor.set(0, 0.5);
        ct.y = VK_DISPLAY_HEIGHT / 2;
        cc.addChild(ct);

        const hit = new Graphics();
        hit.rect(0, 0, 16, VK_DISPLAY_HEIGHT);
        hit.fill({ color: 0x000000, alpha: 0.001 });
        cc.addChild(hit);

        cc.on("pointerover", () => { ct.text = ch; });
        cc.on("pointerout", () => { ct.text = "\u25CF"; });

        cc.x = i * 16;
        charsContainer.addChild(cc);
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

  function onChar(ch: string) {
    if (value.length >= VK_MAX_LENGTH) return;
    value += ch;
    display.update(value);
    opts.onChange?.(value);
    renderKeys();
  }

  function onBackspace() {
    if (value.length === 0) return;
    value = value.slice(0, -1);
    display.update(value);
    opts.onChange?.(value);
    renderKeys();
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
