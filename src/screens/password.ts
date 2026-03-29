import { Container } from "pixi.js";
import {
  createButton,
  createTitle,
  createText,
  createHtmlInput,
  removeHtmlElements,
  type Screen,
} from "@/ui";
import { send, actor } from "@/state";
import { POPUP_WIDTH, POPUP_HEIGHT, PADDING, COLORS } from "@/config";
import * as wm from "@/wallet-manager";

// ── SET_PASSWORD ────────────────────────────────────────

export function setPasswordScreen(): Screen {
  const c = new Container();
  let passInput: HTMLInputElement | undefined;
  let confirmInput: HTMLInputElement | undefined;

  const title = createTitle("Set Password");
  title.x = PADDING;
  title.y = 60;
  c.addChild(title);

  const hint = createText("This password encrypts your wallet locally.", { fontSize: 13 });
  hint.x = PADDING;
  hint.y = 95;
  c.addChild(hint);

  const errorText = createText("", { color: COLORS.danger, fontSize: 12 });
  errorText.x = PADDING;
  errorText.y = 260;
  c.addChild(errorText);

  const statusText = createText("", { color: COLORS.textMuted, fontSize: 12 });
  statusText.x = PADDING;
  statusText.y = 280;
  c.addChild(statusText);

  const btn = createButton({
    label: "Continue",
    onTap: async () => {
      const p = passInput?.value ?? "";
      const confirm = confirmInput?.value ?? "";
      if (p.length < 6) {
        errorText.text = "Password must be at least 6 characters";
        return;
      }
      if (p !== confirm) {
        errorText.text = "Passwords do not match";
        return;
      }

      errorText.text = "";
      statusText.text = "Creating wallet...";

      try {
        const ctx = actor.getSnapshot().context;
        if (ctx.mnemonic.length > 0) {
          // Import flow: mnemonic was provided
          await wm.importFromMnemonic(ctx.mnemonic, p);
        } else {
          // Create flow: generate new
          await wm.create(p);
        }
        send({ type: "PASSWORD_SET" });
      } catch (err) {
        statusText.text = "";
        errorText.text = `Error: ${err instanceof Error ? err.message : err}`;
      }
    },
  });
  btn.x = PADDING;
  btn.y = POPUP_HEIGHT - 90;
  c.addChild(btn);

  return {
    container: c,
    onEnter: () => {
      passInput = createHtmlInput({
        x: PADDING,
        y: 140,
        width: POPUP_WIDTH - PADDING * 2,
        placeholder: "Password (min 6 chars)",
        type: "password",
      });
      confirmInput = createHtmlInput({
        x: PADDING,
        y: 195,
        width: POPUP_WIDTH - PADDING * 2,
        placeholder: "Confirm password",
        type: "password",
      });
    },
    onExit: () => {
      removeHtmlElements(passInput, confirmInput);
      passInput = undefined;
      confirmInput = undefined;
    },
  };
}

// ── UNLOCK ──────────────────────────────────────────────

export function unlockScreen(): Screen {
  const c = new Container();
  let passInput: HTMLInputElement | undefined;

  const title = createTitle("Unlock Wallet");
  title.anchor.set(0.5);
  title.x = POPUP_WIDTH / 2;
  title.y = 120;
  c.addChild(title);

  const errorText = createText("", { color: COLORS.danger, fontSize: 12 });
  errorText.x = PADDING;
  errorText.y = 225;
  c.addChild(errorText);

  const statusText = createText("", { color: COLORS.textMuted, fontSize: 12 });
  statusText.x = PADDING;
  statusText.y = 245;
  c.addChild(statusText);

  const unlockBtn = createButton({
    label: "Unlock",
    onTap: async () => {
      const p = passInput?.value ?? "";
      if (!p) {
        errorText.text = "Enter your password";
        return;
      }

      errorText.text = "";
      statusText.text = "Decrypting...";

      try {
        await wm.unlock(p);
        send({ type: "UNLOCK" });
      } catch {
        statusText.text = "";
        errorText.text = "Wrong password";
      }
    },
  });
  unlockBtn.x = PADDING;
  unlockBtn.y = 270;
  c.addChild(unlockBtn);

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
  resetBtn.y = POPUP_HEIGHT - 70;
  c.addChild(resetBtn);

  return {
    container: c,
    onEnter: () => {
      passInput = createHtmlInput({
        x: PADDING,
        y: 170,
        width: POPUP_WIDTH - PADDING * 2,
        placeholder: "Password",
        type: "password",
      });
    },
    onExit: () => {
      removeHtmlElements(passInput);
      passInput = undefined;
    },
  };
}
