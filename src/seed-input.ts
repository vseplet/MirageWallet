import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { mnemonicWordList } from "@ton/crypto";
import {
  COLORS,
  FONT_FAMILY,
  POPUP_WIDTH,
  POPUP_HEIGHT,
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
    text: label,
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

  c.on("pointerdown", () => draw(COLORS.accentPress));
  c.on("pointerup", () => { draw(color); onTap(); });
  c.on("pointerout", () => draw(color));

  return c;
}

// ── Seed Input ──────────────────────────────────────────

export function createSeedInput(opts: SeedInputOpts): SeedInput {
  const container = new Container();
  const collectedWords: string[] = [];
  let currentInput = "";
  let keysContainer: Container | null = null;
  let suggestContainer: Container | null = null;
  let wordsContainer: Container | null = null;

  // ── Header: progress ──────────────────────────────────

  const progress = new Text({
    text: `Word 1 / ${MNEMONIC_WORD_COUNT}`,
    style: new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: 14,
      fontWeight: "bold",
      fill: COLORS.accent,
    }),
  });
  progress.x = PADDING;
  progress.y = 10;
  container.addChild(progress);

  // ── Collected words area ──────────────────────────────

  function renderCollectedWords() {
    if (wordsContainer) {
      container.removeChild(wordsContainer);
      wordsContainer.destroy({ children: true });
    }
    wordsContainer = new Container();
    wordsContainer.x = PADDING;
    wordsContainer.y = 30;

    // Grid: 8 cols of small word chips
    const chipW = 38;
    const chipH = 16;
    const chipGap = 2;
    const chipCols = 8;

    for (let i = 0; i < collectedWords.length; i++) {
      const word = collectedWords[i]!;
      const col = i % chipCols;
      const row = Math.floor(i / chipCols);

      const chip = new Container();
      chip.eventMode = "static";
      chip.cursor = "default";
      chip.x = col * (chipW + chipGap);
      chip.y = row * (chipH + chipGap);

      const label = new Text({
        text: `${i + 1}.●●`,
        style: new TextStyle({
          fontFamily: FONT_FAMILY,
          fontSize: 9,
          fill: COLORS.textMuted,
        }),
      });
      chip.addChild(label);

      // Hit area
      const hit = new Graphics();
      hit.rect(0, 0, chipW, chipH);
      hit.fill({ color: 0x000000, alpha: 0.001 });
      chip.addChild(hit);

      chip.on("pointerover", () => {
        label.text = `${i + 1}.${word}`;
        label.style.fill = COLORS.text;
      });
      chip.on("pointerout", () => {
        label.text = `${i + 1}.●●`;
        label.style.fill = COLORS.textMuted;
      });

      wordsContainer.addChild(chip);
    }

    container.addChild(wordsContainer);
  }

  // ── Current input display ─────────────────────────────

  // Dynamic Y based on collected words rows
  function getInputY(): number {
    const rows = Math.ceil(collectedWords.length / 8);
    return 30 + rows * 18 + 4;
  }

  const inputBg = new Graphics();
  container.addChild(inputBg);

  const charsContainer = new Container();
  container.addChild(charsContainer);

  function renderInput() {
    const y = getInputY();

    inputBg.clear();
    inputBg.roundRect(0, 0, GRID_W, 36, 8);
    inputBg.fill(COLORS.inputBg);
    inputBg.stroke({ width: 1, color: COLORS.inputBorder });
    inputBg.x = PADDING;
    inputBg.y = y;

    // Clear chars
    while (charsContainer.children.length) {
      charsContainer.removeChildAt(0);
    }
    charsContainer.x = PADDING + 10;
    charsContainer.y = y + 2;

    for (let i = 0; i < currentInput.length; i++) {
      const ch = currentInput[i]!;
      const cc = new Container();
      cc.eventMode = "static";
      cc.cursor = "default";

      const ct = new Text({
        text: "\u25CF",
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 18, fill: "#ffffff" }),
      });
      ct.y = 6;
      cc.addChild(ct);

      const hit = new Graphics();
      hit.rect(0, 0, 16, 32);
      hit.fill({ color: 0x000000, alpha: 0.001 });
      cc.addChild(hit);

      cc.on("pointerover", () => { ct.text = ch; });
      cc.on("pointerout", () => { ct.text = "\u25CF"; });

      cc.x = i * 16;
      charsContainer.addChild(cc);
    }
  }

  // ── Suggestions ───────────────────────────────────────

  function getSuggestY(): number {
    return getInputY() + 42;
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
    suggestContainer.y = getSuggestY();

    const btnW = Math.floor((GRID_W - VK_GAP * (SUGGEST_MAX - 1)) / SUGGEST_MAX);
    const btnH = 30;

    for (let i = 0; i < suggestions.length; i++) {
      const word = suggestions[i]!;
      const btn = createKey(word, btnW, btnH, () => selectWord(word), COLORS.accent, 12);
      btn.x = i * (btnW + VK_GAP);
      suggestContainer.addChild(btn);
    }

    container.addChild(suggestContainer);
  }

  // ── Actions ───────────────────────────────────────────

  function selectWord(word: string) {
    collectedWords.push(word);
    currentInput = "";

    if (collectedWords.length === MNEMONIC_WORD_COUNT) {
      opts.onComplete([...collectedWords]);
      return;
    }

    updateAll();
  }

  function onChar(ch: string) {
    if (currentInput.length >= 12) return;
    currentInput += ch;
    updateAll();
  }

  function onBackspace() {
    if (currentInput.length > 0) {
      currentInput = currentInput.slice(0, -1);
    } else if (collectedWords.length > 0) {
      currentInput = collectedWords.pop()!;
    }
    updateAll();
  }

  function updateAll() {
    progress.text = `Word ${collectedWords.length + 1} / ${MNEMONIC_WORD_COUNT}`;
    renderCollectedWords();
    renderInput();
    updateSuggestions();
    renderKeys();
  }

  // ── Keyboard ──────────────────────────────────────────

  function getKbY(): number {
    const hasSuggestions = getSuggestions(currentInput).length > 0;
    return getSuggestY() + (hasSuggestions ? 36 : 0);
  }

  const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
  const cols = 7;
  const keyH = 38;
  const keyW = Math.floor((GRID_W - VK_GAP * (cols - 1)) / cols);

  function renderKeys() {
    if (keysContainer) {
      container.removeChild(keysContainer);
      keysContainer.destroy({ children: true });
    }

    keysContainer = new Container();
    keysContainer.x = PADDING;
    keysContainer.y = getKbY();

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

  // ── Fixed bottom: Del + Confirm + Cancel ──────────────

  const bottomY = POPUP_HEIGHT - 100;
  const thirdW = Math.floor((GRID_W - VK_GAP * 2) / 3);

  const backspace = createKey("\u2190 Del", thirdW, 38, onBackspace, COLORS.danger, 12);
  backspace.x = PADDING;
  backspace.y = bottomY;
  container.addChild(backspace);

  const confirmWord = createKey("Confirm", thirdW, 38, () => {
    if (currentInput.length < 2) return;
    // Check if exact match in wordlist
    if (WORDLIST.includes(currentInput.toLowerCase())) {
      selectWord(currentInput.toLowerCase());
    }
  }, COLORS.accent, 12);
  confirmWord.x = PADDING + thirdW + VK_GAP;
  confirmWord.y = bottomY;
  container.addChild(confirmWord);

  const back = createKey("Cancel", thirdW, 38, () => opts.onBack(), COLORS.panel, 12);
  back.x = PADDING + (thirdW + VK_GAP) * 2;
  back.y = bottomY;
  container.addChild(back);

  // ── Init ──────────────────────────────────────────────

  updateAll();

  return {
    container,
    destroy: () => container.destroy({ children: true }),
  };
}
