import { Container } from "pixi.js";
import { createButton, createTitle, createText, createPanel, type Screen } from "@/ui";
import { send } from "@/state";
import { POPUP_WIDTH, PADDING, COLORS, FONT_SIZE } from "@/config";
import { createWallet } from "@/ton";

export function createScreen(): Screen {
  const c = new Container();

  const title = createTitle("Your Seed Phrase");
  title.x = PADDING;
  title.y = 16;
  c.addChild(title);

  const warn = createText("Write down these 24 words. Never share them.", {
    color: COLORS.warning,
    fontSize: FONT_SIZE.small,
  });
  warn.x = PADDING;
  warn.y = 48;
  c.addChild(warn);

  const panel = createPanel(POPUP_WIDTH - PADDING * 2, 260);
  panel.x = PADDING;
  panel.y = 72;
  c.addChild(panel);

  const loading = createText("Generating wallet...", { color: COLORS.textMuted, align: "center" });
  loading.anchor.set(0.5);
  loading.x = POPUP_WIDTH / 2;
  loading.y = 200;
  c.addChild(loading);

  let mnemonic: string[] = [];

  const confirmBtn = createButton({
    label: "I've saved it",
    onTap: () => {
      if (mnemonic.length === 24) {
        send({ type: "MNEMONIC_CONFIRMED", mnemonic });
      }
    },
  });
  confirmBtn.x = PADDING;
  confirmBtn.y = 348;
  confirmBtn.visible = false;
  c.addChild(confirmBtn);

  const backBtn = createButton({
    label: "Back",
    color: 0x16213e,
    hoverColor: 0x1a2744,
    pressColor: 0x0f1a2e,
    onTap: () => send({ type: "BACK" }),
  });
  backBtn.x = PADDING;
  backBtn.y = 406;
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
        for (let i = 0; i < mnemonic.length; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const t = createText(`${i + 1}. ${mnemonic[i]}`, {
            fontSize: FONT_SIZE.small,
            color: COLORS.text,
          });
          t.x = PADDING + col * cellW + 8;
          t.y = 80 + row * 30;
          c.addChild(t);
        }
        confirmBtn.visible = true;
      } catch (err) {
        loading.text = `Error: ${err}`;
      }
    },
  };
}
