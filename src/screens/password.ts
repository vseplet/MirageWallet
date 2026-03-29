import { Container } from "pixi.js";
import { createTitle, createText, type Screen } from "@/ui";
import { send, actor } from "@/state";
import { POPUP_WIDTH, POPUP_HEIGHT, PADDING, COLORS, MIN_PASSWORD_LENGTH, S } from "@/config";
import { createVirtualKeyboard } from "@/virtual-keyboard";
import * as wm from "@/wallet-manager";

// ── SET_PASSWORD ────────────────────────────────────────

export function setPasswordScreen(): Screen {
  const c = new Container();
  let step: "password" | "confirm" = "password";
  let firstPassword = "";

  const title = createTitle(S.setPasswordTitle);
  title.x = PADDING;
  title.y = 14;
  c.addChild(title);

  const stepLabel = createText(S.step1, {
    fontSize: 13,
    color: COLORS.accent,
  });
  stepLabel.x = PADDING;
  stepLabel.y = 44;
  c.addChild(stepLabel);

  const errorText = createText("", { color: COLORS.danger, fontSize: 12 });
  errorText.anchor.set(0.5);
  errorText.x = POPUP_WIDTH / 2;
  errorText.y = POPUP_HEIGHT - 16;
  c.addChild(errorText);

  const kb = createVirtualKeyboard({
    y: 66,
    onSubmit: async (value) => {
      if (step === "password") {
        if (value.length < MIN_PASSWORD_LENGTH) {
          errorText.text = S.passwordTooShort;
          return;
        }
        firstPassword = value;
        step = "confirm";
        stepLabel.text = S.step2;
        errorText.text = "";
        kb.clear();
        kb.shuffle();
      } else {
        if (value !== firstPassword) {
          errorText.text = S.passwordsMismatch;
          step = "password";
          firstPassword = "";
          stepLabel.text = S.step1;
          kb.clear();
          kb.shuffle();
          return;
        }

        errorText.text = "";
        stepLabel.text = S.creatingWallet;

        try {
          const ctx = actor.getSnapshot().context;
          if (ctx.mnemonic.length > 0) {
            await wm.importFromMnemonic(ctx.mnemonic, value);
          } else {
            await wm.create(value);
          }
          send({ type: "PASSWORD_SET" });
        } catch (err) {
          stepLabel.text = S.step1;
          errorText.text = `Error: ${err instanceof Error ? err.message : err}`;
        }
      }
    },
  });
  c.addChild(kb.container);

  return { container: c };
}

// ── UNLOCK ──────────────────────────────────────────────

export function unlockScreen(): Screen {
  const c = new Container();

  const title = createTitle(S.unlockTitle);
  title.x = PADDING;
  title.y = 14;
  c.addChild(title);

  const hint = createText(S.enterPassword, {
    fontSize: 13,
    color: COLORS.textDim,
  });
  hint.x = PADDING;
  hint.y = 44;
  c.addChild(hint);

  const errorText = createText("", { color: COLORS.danger, fontSize: 12 });
  errorText.anchor.set(0.5);
  errorText.x = POPUP_WIDTH / 2;
  errorText.y = POPUP_HEIGHT - 40;
  c.addChild(errorText);

  const kb = createVirtualKeyboard({
    y: 66,
    onSubmit: async (value) => {
      if (!value) {
        errorText.text = S.enterPassword;
        return;
      }

      errorText.text = "";
      hint.text = S.decrypting;

      try {
        await wm.unlock(value);
        send({ type: "UNLOCK" });
      } catch {
        hint.text = S.enterPassword;
        errorText.text = S.wrongPassword;
        kb.clear();
        kb.shuffle();
      }
    },
  });
  c.addChild(kb.container);


  return { container: c };
}
