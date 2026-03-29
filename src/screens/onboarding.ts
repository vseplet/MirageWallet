import { Container } from "pixi.js";
import { createButton, createTitle, createText, SECONDARY_BTN, type Screen } from "@/ui";
import { send } from "@/state";
import { POPUP_WIDTH, POPUP_HEIGHT, PADDING, FONT_SIZE, APP_NAME, S } from "@/config";

export function onboardingScreen(): Screen {
  const c = new Container();

  const title = createTitle(APP_NAME);
  title.anchor.set(0.5);
  title.x = POPUP_WIDTH / 2;
  title.y = 120;
  c.addChild(title);

  const sub = createText(S.subtitle, {
    align: "center",
    fontSize: FONT_SIZE.body,
  });
  sub.anchor.set(0.5);
  sub.x = POPUP_WIDTH / 2;
  sub.y = 155;
  c.addChild(sub);

  const createBtn = createButton({
    label: S.createWallet,
    onTap: () => send({ type: "CREATE" }),
  });
  createBtn.x = PADDING;
  createBtn.y = POPUP_HEIGHT - 150;
  c.addChild(createBtn);

  const importBtn = createButton({
    label: S.importWallet,
    ...SECONDARY_BTN,
    onTap: () => send({ type: "IMPORT" }),
  });
  importBtn.x = PADDING;
  importBtn.y = POPUP_HEIGHT - 90;
  c.addChild(importBtn);

  return { container: c };
}
