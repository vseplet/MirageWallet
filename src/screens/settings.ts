import { Container } from "pixi.js";
import { createButton, createTitle, createText, SECONDARY_BTN, type Screen } from "@/ui";
import { send } from "@/state";
import { POPUP_HEIGHT, PADDING, COLORS } from "@/config";
import * as wm from "@/wallet-manager";

export function settingsScreen(): Screen {
  const c = new Container();

  const title = createTitle("Settings");
  title.x = PADDING;
  title.y = 16;
  c.addChild(title);

  const version = createText("MirageWallet v0.1.0 \u2014 TON Testnet", {
    fontSize: 12,
    color: COLORS.textMuted,
  });
  version.x = PADDING;
  version.y = 50;
  c.addChild(version);

  const resetBtn = createButton({
    label: "Reset Wallet",
    color: COLORS.danger,
    hoverColor: COLORS.dangerHover,
    pressColor: COLORS.dangerPress,
    onTap: () => {
      wm.reset();
      send({ type: "RESET" });
    },
  });
  resetBtn.x = PADDING;
  resetBtn.y = 200;
  c.addChild(resetBtn);

  const backBtn = createButton({
    label: "Back",
    ...SECONDARY_BTN,
    onTap: () => send({ type: "BACK" }),
  });
  backBtn.x = PADDING;
  backBtn.y = POPUP_HEIGHT - 68;
  c.addChild(backBtn);

  return { container: c };
}
