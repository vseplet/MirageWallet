import { Container } from "pixi.js";
import { createButton, createTitle, createText, createPanel, type Screen } from "@/ui";
import { send } from "@/state";
import { POPUP_WIDTH, POPUP_HEIGHT, PADDING, COLORS, FONT_SIZE } from "@/config";
import * as wm from "@/wallet-manager";

export function receiveScreen(): Screen {
  const c = new Container();
  let fullAddr = "";
  try {
    fullAddr = wm.getAddress();
  } catch { /* locked */ }

  const title = createTitle("Receive TON");
  title.x = PADDING;
  title.y = 16;
  c.addChild(title);

  const hint = createText("Share this address to receive TON on testnet.", { fontSize: 13 });
  hint.x = PADDING;
  hint.y = 50;
  c.addChild(hint);

  const panel = createPanel(POPUP_WIDTH - PADDING * 2, 80);
  panel.x = PADDING;
  panel.y = 90;
  c.addChild(panel);

  const addrText = createText(fullAddr, {
    fontSize: 11,
    color: COLORS.text,
    maxWidth: POPUP_WIDTH - PADDING * 4,
  });
  addrText.x = PADDING + 12;
  addrText.y = 105;
  c.addChild(addrText);

  const feedbackText = createText("", {
    fontSize: FONT_SIZE.small,
    color: COLORS.success,
    align: "center",
  });
  feedbackText.anchor.set(0.5);
  feedbackText.x = POPUP_WIDTH / 2;
  feedbackText.y = 258;
  c.addChild(feedbackText);

  const copyBtn = createButton({
    label: "Copy Address",
    onTap: async () => {
      try {
        await navigator.clipboard.writeText(fullAddr);
        feedbackText.text = "Copied!";
        setTimeout(() => { feedbackText.text = ""; }, 2000);
      } catch {
        feedbackText.text = "Failed to copy";
      }
    },
  });
  copyBtn.x = PADDING;
  copyBtn.y = 200;
  c.addChild(copyBtn);

  const backBtn = createButton({
    label: "Back",
    color: 0x16213e,
    hoverColor: 0x1a2744,
    pressColor: 0x0f1a2e,
    onTap: () => send({ type: "BACK" }),
  });
  backBtn.x = PADDING;
  backBtn.y = POPUP_HEIGHT - 68;
  c.addChild(backBtn);

  return { container: c };
}
