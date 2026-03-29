import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { mnemonicWordList } from "@ton/crypto";
import {
  COLORS,
  FONT_FAMILY,
  POPUP_WIDTH,
  PADDING,
  MNEMONIC_WORD_COUNT,
  VK_GAP,
  VK_KEY_RADIUS,
} from "@/config";

// ── Types ───────────────────────────────────────────────

export interface SeedInputOpts {
  onComplete: (words: string[]) => void;
  onBack: () => void;
}

export interface SeedInput {
  container: Container;
  destroy: () => void;
}

// ── Helpers ─────────────────────────────────────────────

const WORDLIST: string[] = mnemonicWordList ?? [];
const GRID_W = POPUP_WIDTH - PADDING * 2;
const SUGGEST_MAX = 4;

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

function getSuggestions(prefix: string): string[] {
  if (prefix.length < 2) return [];
  const p = prefix.toLowerCase();
  return WORDLIST.filter((w) => w.startsWith(p)).slice(0, SUGGEST_MAX);
}

// ── Key ─────────────────────────────────────────────────

function createKey(
  label: string,
  w: number,
  h: number,
  onTap: () => void,
  color: number = COLORS.keyConsonant,
  fontSize = 18,
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
      fontSize,
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
  c.on("pointerup", () => { draw(color); onTap(); });

  return c;
}

// ── Seed Input ──────────────────────────────────────────

export function createSeedInput(opts: SeedInputOpts): SeedInput {
  const container = new Container();
  const collectedWords: string[] = [];
  let currentInput = "";
  let keysContainer: Container | null = null;
  let suggestContainer: Container | null = null;

  // ── Header: progress ──────────────────────────────────

  const progress = new Text({
    text: `Word 1 / ${MNEMONIC_WORD_COUNT}`,
    style: new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: 16,
      fontWeight: "bold",
      fill: COLORS.accent,
    }),
  });
  progress.x = PADDING;
  progress.y = 14;
  container.addChild(progress);

  // ── Collected words display (compact) ─────────────────

  const wordsText = new Text({
    text: "",
    style: new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: 10,
      fill: COLORS.textMuted,
      wordWrap: true,
      wordWrapWidth: GRID_W,
    }),
  });
  wordsText.x = PADDING;
  wordsText.y = 38;
  container.addChild(wordsText);

  // ── Current input display ─────────────────────────────

  const inputBg = new Graphics();
  inputBg.roundRect(0, 0, GRID_W, 40, 10);
  inputBg.fill(COLORS.inputBg);
  inputBg.stroke({ width: 1, color: COLORS.inputBorder });
  inputBg.x = PADDING;
  inputBg.y = 62;
  container.addChild(inputBg);

  const charsContainer = new Container();
  charsContainer.x = PADDING + 10;
  charsContainer.y = 64;
  container.addChild(charsContainer);

  function renderInputChars() {
    while (charsContainer.children.length) {
      charsContainer.removeChildAt(0);
    }
    for (let i = 0; i < currentInput.length; i++) {
      const ch = currentInput[i]!;
      const charContainer = new Container();
      charContainer.eventMode = "static";
      charContainer.cursor = "default";

      const charText = new Text({
        text: "\u25CF",
        style: new TextStyle({
          fontFamily: FONT_FAMILY,
          fontSize: 20,
          fill: "#ffffff",
        }),
      });
      charText.y = 8;
      charContainer.addChild(charText);

      // Hit area for hover
      const hitArea = new Graphics();
      hitArea.rect(0, 0, 18, 36);
      hitArea.fill({ color: 0x000000, alpha: 0.001 });
      charContainer.addChild(hitArea);

      charContainer.on("pointerover", () => { charText.text = ch; });
      charContainer.on("pointerout", () => { charText.text = "\u25CF"; });

      charContainer.x = i * 18;
      charsContainer.addChild(charContainer);
    }
  }

  // ── Error text ────────────────────────────────────────

  const errorText = new Text({
    text: "",
    style: new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: 11,
      fill: COLORS.danger,
    }),
  });
  errorText.anchor.set(0.5);
  errorText.x = POPUP_WIDTH / 2;
  errorText.y = 490;
  container.addChild(errorText);

  // ── Update functions ──────────────────────────────────

  function updateDisplay() {
    renderInputChars();
    progress.text = `Word ${collectedWords.length + 1} / ${MNEMONIC_WORD_COUNT}`;
    wordsText.text = collectedWords.map((w, i) => `${i + 1}.\u25CF\u25CF\u25CF`).join("  ");
  }

  function updateSuggestions() {
    if (suggestContainer) {
      container.removeChild(suggestContainer);
      suggestContainer.destroy({ children: true });
      suggestContainer = null;
    }

    const suggestions = getSuggestions(currentInput);
    if (suggestions.length === 0) return;

    suggestContainer = new Container();
    suggestContainer.x = PADDING;
    suggestContainer.y = 108;

    const btnW = Math.floor((GRID_W - VK_GAP * (SUGGEST_MAX - 1)) / SUGGEST_MAX);
    const btnH = 34;

    for (let i = 0; i < suggestions.length; i++) {
      const word = suggestions[i]!;
      const btn = createKey(word, btnW, btnH, () => selectWord(word), COLORS.accent, 13);
      btn.x = i * (btnW + VK_GAP);
      suggestContainer.addChild(btn);
    }

    container.addChild(suggestContainer);
  }

  function selectWord(word: string) {
    collectedWords.push(word);
    currentInput = "";
    errorText.text = "";

    if (collectedWords.length === MNEMONIC_WORD_COUNT) {
      opts.onComplete(collectedWords);
      return;
    }

    updateDisplay();
    updateSuggestions();
    renderKeys();
  }

  function onChar(ch: string) {
    if (currentInput.length >= 12) return;
    currentInput += ch;
    updateDisplay();
    updateSuggestions();
  }

  function onBackspace() {
    if (currentInput.length > 0) {
      currentInput = currentInput.slice(0, -1);
    } else if (collectedWords.length > 0) {
      // Undo last word
      currentInput = collectedWords.pop()!;
    }
    updateDisplay();
    updateSuggestions();
  }

  // ── Keyboard ──────────────────────────────────────────

  const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
  const cols = 7;
  const keyH = 42;
  const keyW = Math.floor((GRID_W - VK_GAP * (cols - 1)) / cols);
  const kbY = 148;

  function renderKeys() {
    if (keysContainer) {
      container.removeChild(keysContainer);
      keysContainer.destroy({ children: true });
    }

    keysContainer = new Container();
    keysContainer.x = PADDING;
    keysContainer.y = kbY;

    const shuffled = shuffleArray(LETTERS);

    for (let i = 0; i < shuffled.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const ch = shuffled[i]!;

      const isVowel = "aeiou".includes(ch);
      const keyColor = isVowel ? COLORS.keyVowel : COLORS.keyConsonant;
      const key = createKey(ch, keyW, keyH, () => onChar(ch), keyColor);
      key.x = col * (keyW + VK_GAP);
      key.y = row * (keyH + VK_GAP);
      keysContainer.addChild(key);
    }

    container.addChild(keysContainer);
  }

  // ── Fixed bottom buttons ───────────────────────────────

  const bottomY = 400;
  const halfW = Math.floor((GRID_W - VK_GAP) / 2);

  const backspace = createKey("\u2190 Del", halfW, 42, onBackspace, COLORS.danger, 13);
  backspace.x = PADDING;
  backspace.y = bottomY;
  container.addChild(backspace);

  const back = createKey("Cancel", halfW, 42, () => opts.onBack(), COLORS.panel, 13);
  back.x = PADDING + halfW + VK_GAP;
  back.y = bottomY;
  container.addChild(back);

  renderKeys();
  updateDisplay();

  return {
    container,
    destroy: () => container.destroy({ children: true }),
  };
}
