import { Container } from "pixi.js";
import { createButton, createTitle, createText, type Screen } from "@/ui";
import { send } from "@/state";
import { POPUP_WIDTH, POPUP_HEIGHT, PADDING } from "@/config";

export function onboardingScreen(): Screen {
  const c = new Container();

  const title = createTitle("ArtWallet");
  title.anchor.set(0.5);
  title.x = POPUP_WIDTH / 2;
  title.y = 120;
  c.addChild(title);

  const sub = createText("Self-custodial TON wallet", {
    align: "center",
    fontSize: 14,
  });
  sub.anchor.set(0.5);
  sub.x = POPUP_WIDTH / 2;
  sub.y = 155;
  c.addChild(sub);

  const createBtn = createButton({
    label: "Create Wallet",
    onTap: () => send({ type: "CREATE" }),
  });
  createBtn.x = PADDING;
  createBtn.y = POPUP_HEIGHT - 150;
  c.addChild(createBtn);

  const importBtn = createButton({
    label: "Import Wallet",
    color: 0x16213e,
    hoverColor: 0x1a2744,
    pressColor: 0x0f1a2e,
    onTap: () => send({ type: "IMPORT" }),
  });
  importBtn.x = PADDING;
  importBtn.y = POPUP_HEIGHT - 90;
  c.addChild(importBtn);

  return { container: c };
}
