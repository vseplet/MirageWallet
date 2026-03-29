import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { createButton, createTitle, createText, createPanel, SECONDARY_BTN, type Screen } from "@/ui";
import { send } from "@/state";
import { POPUP_WIDTH, PADDING, COLORS, FONT_SIZE, FONT_FAMILY, MNEMONIC_WORD_COUNT, S } from "@/config";
import { createWallet } from "@/ton";

function shuffleIndices(len: number): number[] {
  const arr = Array.from({ length: len }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function createScreen(): Screen {
  const c = new Container();

  const title = createTitle(S.seedTitle);
  title.x = PADDING;
  title.y = 16;
  c.addChild(title);

  const warn = createText(S.seedHint, {
    color: COLORS.warning,
    fontSize: 11,
  });
  warn.x = PADDING;
  warn.y = 48;
  c.addChild(warn);

  const panel = createPanel(POPUP_WIDTH - PADDING * 2, 280);
  panel.x = PADDING;
  panel.y = 68;
  c.addChild(panel);

  const loading = createText(S.generating, { color: COLORS.textMuted, align: "center" });
  loading.anchor.set(0.5);
  loading.x = POPUP_WIDTH / 2;
  loading.y = 200;
  c.addChild(loading);

  let mnemonic: string[] = [];

  const confirmBtn = createButton({
    label: S.seedConfirm,
    onTap: () => {
      if (mnemonic.length === MNEMONIC_WORD_COUNT) {
        send({ type: "MNEMONIC_CONFIRMED", mnemonic });
      }
    },
  });
  confirmBtn.x = PADDING;
  confirmBtn.y = 362;
  confirmBtn.visible = false;
  c.addChild(confirmBtn);

  const backBtn = createButton({
    label: S.back,
    ...SECONDARY_BTN,
    onTap: () => send({ type: "BACK" }),
  });
  backBtn.x = PADDING;
  backBtn.y = 420;
  c.addChild(backBtn);

  return {
    container: c,
    onEnter: async () => {
      try {
        const w = await createWallet();
        mnemonic = w.mnemonic;
        loading.visible = false;

        const cols = 3;
        const cellW = (POPUP_WIDTH - PADDING * 2) / cols;
        const rowH = 34;

        // Shuffled: words placed in random grid positions
        const shuffled = shuffleIndices(mnemonic.length);

        for (let gridPos = 0; gridPos < shuffled.length; gridPos++) {
          const realIdx = shuffled[gridPos]!;
          const word = mnemonic[realIdx]!;
          const col = gridPos % cols;
          const row = Math.floor(gridPos / cols);

          const wordContainer = new Container();
          wordContainer.x = PADDING + col * cellW + 4;
          wordContainer.y = 76 + row * rowH;
          wordContainer.eventMode = "static";
          wordContainer.cursor = "pointer";

          // Hit area
          const hit = new Graphics();
          hit.rect(0, 0, cellW - 8, rowH - 4);
          hit.fill({ color: 0x000000, alpha: 0.001 });
          wordContainer.addChild(hit);

          const maxLen = Math.max(...mnemonic.map((w) => w.length));
          const hidden = "█".repeat(maxLen);
          const revealed = `${realIdx + 1}. ${word}`;

          const label = new Text({
            text: hidden,
            style: new TextStyle({
              fontFamily: FONT_FAMILY,
              fontSize: FONT_SIZE.small,
              fill: COLORS.textDim,
            }),
          });
          label.y = 4;
          label.x = 4;
          wordContainer.addChild(label);

          wordContainer.on("pointerover", () => {
            label.text = revealed;
            label.style.fill = COLORS.text;
          });
          wordContainer.on("pointerout", () => {
            label.text = hidden;
            label.style.fill = COLORS.textDim;
          });

          c.addChild(wordContainer);
        }

        confirmBtn.visible = true;
      } catch (err) {
        loading.text = `Error: ${err}`;
      }
    },
  };
}
