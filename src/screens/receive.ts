import { Container } from "pixi.js";
import { createButton, createTitle, createText, createPanel, removeHtmlElements, SECONDARY_BTN, type Screen } from "@/ui";
import { send } from "@/state";
import { POPUP_WIDTH, POPUP_HEIGHT, PADDING, COLORS, FONT_SIZE, QR_CODE_SIZE, QR_CODE_MARGIN, FEEDBACK_TIMEOUT_MS } from "@/config";
import * as wm from "@/wallet-manager";
import QRCode from "qrcode";

export function receiveScreen(): Screen {
  const c = new Container();
  let qrCanvas: HTMLCanvasElement | undefined;

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

  // Address panel
  const panel = createPanel(POPUP_WIDTH - PADDING * 2, 56);
  panel.x = PADDING;
  panel.y = 250;
  c.addChild(panel);

  const addrText = createText(fullAddr, {
    fontSize: 10,
    color: COLORS.text,
    maxWidth: POPUP_WIDTH - PADDING * 4,
  });
  addrText.anchor.set(0.5);
  addrText.x = POPUP_WIDTH / 2;
  addrText.y = 278;
  c.addChild(addrText);

  // Feedback
  const feedbackText = createText("", {
    fontSize: FONT_SIZE.small,
    color: COLORS.success,
    align: "center",
  });
  feedbackText.anchor.set(0.5);
  feedbackText.x = POPUP_WIDTH / 2;
  feedbackText.y = 380;
  c.addChild(feedbackText);

  // Copy button
  const copyBtn = createButton({
    label: "Copy Address",
    onTap: async () => {
      try {
        await navigator.clipboard.writeText(fullAddr);
        feedbackText.text = "Copied!";
        setTimeout(() => { feedbackText.text = ""; }, FEEDBACK_TIMEOUT_MS);
      } catch {
        feedbackText.text = "Failed to copy";
      }
    },
  });
  copyBtn.x = PADDING;
  copyBtn.y = 320;
  c.addChild(copyBtn);

  // Back
  const backBtn = createButton({
    label: "Back",
    ...SECONDARY_BTN,
    onTap: () => send({ type: "BACK" }),
  });
  backBtn.x = PADDING;
  backBtn.y = POPUP_HEIGHT - 68;
  c.addChild(backBtn);

  return {
    container: c,
    onEnter: async () => {
      if (!fullAddr) return;
      try {
        // Render QR to a real canvas element overlaid on top
        qrCanvas = document.createElement("canvas");
        await QRCode.toCanvas(qrCanvas, fullAddr, {
          width: QR_CODE_SIZE,
          margin: QR_CODE_MARGIN,
          color: { dark: "#ffffff", light: `#${COLORS.bg.toString(16).padStart(6, "0")}` },
        });
        Object.assign(qrCanvas.style, {
          position: "absolute",
          left: `${(POPUP_WIDTH - QR_CODE_SIZE) / 2}px`,
          top: "80px",
          borderRadius: "8px",
        });
        document.body.appendChild(qrCanvas);
      } catch {
        // Fallback: show text
      }
    },
    onExit: () => {
      removeHtmlElements(qrCanvas);
      qrCanvas = undefined;
    },
  };
}
