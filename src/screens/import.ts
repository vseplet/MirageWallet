import { Container } from "pixi.js";
import {
  createButton,
  createTitle,
  createText,
  createHtmlTextarea,
  removeHtmlElements,
  type Screen,
} from "@/ui";
import { send } from "@/state";
import { POPUP_WIDTH, PADDING, COLORS } from "@/config";
import { validateMnemonic } from "@/ton";

export function importScreen(): Screen {
  const c = new Container();
  let textarea: HTMLTextAreaElement | undefined;

  const title = createTitle("Import Wallet");
  title.x = PADDING;
  title.y = 16;
  c.addChild(title);

  const hint = createText("Enter your 24-word seed phrase, separated by spaces.", {
    fontSize: 13,
  });
  hint.x = PADDING;
  hint.y = 50;
  c.addChild(hint);

  const errorText = createText("", { color: COLORS.danger, fontSize: 12 });
  errorText.x = PADDING;
  errorText.y = 280;
  c.addChild(errorText);

  const importBtn = createButton({
    label: "Import",
    onTap: async () => {
      const value = textarea?.value.trim() ?? "";
      const words = value.split(/\s+/).filter(Boolean);

      if (words.length !== 24) {
        errorText.text = `Expected 24 words, got ${words.length}`;
        return;
      }

      const valid = await validateMnemonic(words);
      if (!valid) {
        errorText.text = "Invalid mnemonic phrase";
        return;
      }

      send({ type: "MNEMONIC_VALID", mnemonic: words });
    },
  });
  importBtn.x = PADDING;
  importBtn.y = 310;
  c.addChild(importBtn);

  const backBtn = createButton({
    label: "Back",
    color: 0x16213e,
    hoverColor: 0x1a2744,
    pressColor: 0x0f1a2e,
    onTap: () => send({ type: "BACK" }),
  });
  backBtn.x = PADDING;
  backBtn.y = 368;
  c.addChild(backBtn);

  return {
    container: c,
    onEnter: () => {
      textarea = createHtmlTextarea({
        x: PADDING,
        y: 80,
        width: POPUP_WIDTH - PADDING * 2,
        height: 180,
        placeholder: "word1 word2 word3 ...",
      });
    },
    onExit: () => {
      removeHtmlElements(textarea);
      textarea = undefined;
    },
  };
}
