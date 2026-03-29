import { Container } from "pixi.js";
import { createTitle, createText, type Screen } from "@/ui";
import { send, actor } from "@/state";
import { POPUP_WIDTH, POPUP_HEIGHT, PADDING, COLORS, MIN_PASSWORD_LENGTH } from "@/config";
import { createVirtualKeyboard } from "@/virtual-keyboard";
import * as wm from "@/wallet-manager";

// ── SET_PASSWORD ────────────────────────────────────────

export function setPasswordScreen(): Screen {
  const c = new Container();
  let step: "password" | "confirm" = "password";
  let firstPassword = "";

  const title = createTitle("Set Password");
  title.x = PADDING;
  title.y = 14;
  c.addChild(title);

  const stepLabel = createText("Step 1: Enter password (min 6 chars)", {
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
          errorText.text = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
          return;
        }
        firstPassword = value;
        step = "confirm";
        stepLabel.text = "Step 2: Confirm password";
        errorText.text = "";
        kb.clear();
        kb.shuffle();
      } else {
        if (value !== firstPassword) {
          errorText.text = "Passwords do not match. Try again.";
          step = "password";
          firstPassword = "";
          stepLabel.text = "Step 1: Enter password (min 6 chars)";
          kb.clear();
          kb.shuffle();
          return;
        }

        errorText.text = "";
        stepLabel.text = "Creating wallet...";

        try {
          const ctx = actor.getSnapshot().context;
          if (ctx.mnemonic.length > 0) {
            await wm.importFromMnemonic(ctx.mnemonic, value);
          } else {
            await wm.create(value);
          }
          send({ type: "PASSWORD_SET" });
        } catch (err) {
          stepLabel.text = "Step 1: Enter password (min 6 chars)";
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

  const title = createTitle("Unlock Wallet");
  title.x = PADDING;
  title.y = 14;
  c.addChild(title);

  const hint = createText("Enter your password", {
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
        errorText.text = "Enter your password";
        return;
      }

      errorText.text = "";
      hint.text = "Decrypting...";

      try {
        await wm.unlock(value);
        send({ type: "UNLOCK" });
      } catch {
        hint.text = "Enter your password";
        errorText.text = "Wrong password";
        kb.clear();
        kb.shuffle();
      }
    },
  });
  c.addChild(kb.container);


  return { container: c };
}
