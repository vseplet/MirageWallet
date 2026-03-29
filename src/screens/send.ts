import { Container } from "pixi.js";
import {
  createButton,
  createTitle,
  createText,
  createPanel,
  createHtmlInput,
  createSpinner,
  removeHtmlElements,
  SECONDARY_BTN, type Screen,
} from "@/ui";
import { send as sendEvent, actor } from "@/state";
import { POPUP_WIDTH, POPUP_HEIGHT, PADDING, COLORS, FONT_SIZE } from "@/config";
import { validateSend, checkAddressGuard } from "@/ton";
import * as wm from "@/wallet-manager";
import { loadWhitelist, addToWhitelist } from "@/vault";

// ── SEND (form) ─────────────────────────────────────────

export function sendScreen(): Screen {
  const c = new Container();
  let addrInput: HTMLInputElement | undefined;
  let amountInput: HTMLInputElement | undefined;
  let pastedValue = "";
  let currentBalance = "0";

  const title = createTitle("Send TON");
  title.x = PADDING;
  title.y = 16;
  c.addChild(title);

  const addrLabel = createText("Recipient address", { fontSize: FONT_SIZE.small, color: COLORS.textMuted });
  addrLabel.x = PADDING;
  addrLabel.y = 54;
  c.addChild(addrLabel);

  const amountLabel = createText("Amount (TON)", { fontSize: FONT_SIZE.small, color: COLORS.textMuted });
  amountLabel.x = PADDING;
  amountLabel.y = 120;
  c.addChild(amountLabel);

  const balanceHint = createText("Balance: loading...", { fontSize: FONT_SIZE.small, color: COLORS.textMuted });
  balanceHint.x = PADDING;
  balanceHint.y = 186;
  c.addChild(balanceHint);

  const errorText = createText("", { color: COLORS.danger, fontSize: 12 });
  errorText.x = PADDING;
  errorText.y = 210;
  c.addChild(errorText);

  const submitBtn = createButton({
    label: "Review",
    onTap: () => {
      const to = addrInput?.value.trim() ?? "";
      const amount = amountInput?.value.trim() ?? "";

      const validation = validateSend({ address: to, amount, balance: currentBalance });
      if (!validation.valid) {
        errorText.text = validation.error ?? "Invalid input";
        return;
      }

      // Address guard
      let ownAddr = "";
      try { ownAddr = wm.getAddress(); } catch { /* */ }
      const warnings = checkAddressGuard({
        address: to,
        ownAddress: ownAddr,
        whitelist: loadWhitelist(),
        clipboardOriginal: pastedValue || undefined,
      });

      if (warnings.length > 0) {
        sendEvent({
          type: "WARNING_DETECTED",
          warnings: warnings.map((w) => w.message),
          to,
          amount,
        });
        return;
      }

      sendEvent({ type: "SUBMIT_SEND", to, amount });
    },
  });
  submitBtn.x = PADDING;
  submitBtn.y = 250;
  c.addChild(submitBtn);

  const backBtn = createButton({
    label: "Cancel",
    ...SECONDARY_BTN,
    onTap: () => sendEvent({ type: "BACK" }),
  });
  backBtn.x = PADDING;
  backBtn.y = 310;
  c.addChild(backBtn);

  return {
    container: c,
    onEnter: async () => {
      addrInput = createHtmlInput({
        x: PADDING, y: 72,
        width: POPUP_WIDTH - PADDING * 2,
        placeholder: "EQ... or UQ...",
      });
      amountInput = createHtmlInput({
        x: PADDING, y: 138,
        width: POPUP_WIDTH - PADDING * 2,
        placeholder: "0.00",
      });

      // Track paste for clipboard hijack detection
      addrInput.addEventListener("paste", (e) => {
        const pasted = e.clipboardData?.getData("text") ?? "";
        pastedValue = pasted;
      });

      // Use cached balance immediately, then try to refresh
      currentBalance = wm.getCachedBalance();
      balanceHint.text = `Balance: ${currentBalance} TON`;

      wm.fetchBalance().then((bal) => {
        currentBalance = bal;
        balanceHint.text = `Balance: ${currentBalance} TON`;
      }).catch(() => {});
    },
    onExit: () => {
      removeHtmlElements(addrInput, amountInput);
      addrInput = undefined;
      amountInput = undefined;
    },
  };
}

// ── SEND_WARNING ────────────────────────────────────────

export function sendWarningScreen(): Screen {
  const c = new Container();
  const ctx = actor.getSnapshot().context;

  const title = createTitle("Warning");
  title.x = PADDING;
  title.y = 16;
  c.addChild(title);

  const icon = createText("\u26A0", { fontSize: 48, color: COLORS.warning, align: "center" });
  icon.anchor.set(0.5);
  icon.x = POPUP_WIDTH / 2;
  icon.y = 80;
  c.addChild(icon);

  const panel = createPanel(POPUP_WIDTH - PADDING * 2, 160, COLORS.warningBg);
  panel.x = PADDING;
  panel.y = 120;
  c.addChild(panel);

  const warnings = ctx.sendWarnings.join("\n\n");
  const warnText = createText(warnings || "Potential risk detected.", {
    color: COLORS.warning,
    fontSize: 13,
    maxWidth: POPUP_WIDTH - PADDING * 4,
  });
  warnText.x = PADDING + 12;
  warnText.y = 132;
  c.addChild(warnText);

  const anywayBtn = createButton({
    label: "Send Anyway",
    color: COLORS.danger,
    hoverColor: COLORS.dangerHover,
    pressColor: COLORS.dangerPress,
    onTap: () => {
      // Move to confirm with stored sendTo/sendAmount
      sendEvent({ type: "SEND_ANYWAY" });
    },
  });
  anywayBtn.x = PADDING;
  anywayBtn.y = 310;
  c.addChild(anywayBtn);

  const cancelBtn = createButton({
    label: "Cancel",
    ...SECONDARY_BTN,
    onTap: () => sendEvent({ type: "CANCEL" }),
  });
  cancelBtn.x = PADDING;
  cancelBtn.y = 370;
  c.addChild(cancelBtn);

  return { container: c };
}

// ── SEND_CONFIRM ────────────────────────────────────────

export function sendConfirmScreen(): Screen {
  const c = new Container();
  const ctx = actor.getSnapshot().context;

  const title = createTitle("Confirm Transaction");
  title.x = PADDING;
  title.y = 16;
  c.addChild(title);

  const panel = createPanel(POPUP_WIDTH - PADDING * 2, 160);
  panel.x = PADDING;
  panel.y = 60;
  c.addChild(panel);

  const toLabel = createText("To:", { fontSize: FONT_SIZE.small, color: COLORS.textMuted });
  toLabel.x = PADDING + 12;
  toLabel.y = 75;
  c.addChild(toLabel);

  const toAddr = createText(ctx.sendTo || "...", {
    fontSize: 11,
    color: COLORS.text,
    maxWidth: POPUP_WIDTH - PADDING * 4,
  });
  toAddr.x = PADDING + 12;
  toAddr.y = 95;
  c.addChild(toAddr);

  const amtLabel = createText("Amount:", { fontSize: FONT_SIZE.small, color: COLORS.textMuted });
  amtLabel.x = PADDING + 12;
  amtLabel.y = 140;
  c.addChild(amtLabel);

  const amtVal = createTitle(`${ctx.sendAmount || "0"} TON`, 20);
  amtVal.x = PADDING + 12;
  amtVal.y = 160;
  c.addChild(amtVal);

  const confirmBtn = createButton({
    label: "Confirm & Send",
    onTap: () => sendEvent({ type: "CONFIRM" }),
  });
  confirmBtn.x = PADDING;
  confirmBtn.y = 260;
  c.addChild(confirmBtn);

  const cancelBtn = createButton({
    label: "Cancel",
    ...SECONDARY_BTN,
    onTap: () => sendEvent({ type: "CANCEL" }),
  });
  cancelBtn.x = PADDING;
  cancelBtn.y = 320;
  c.addChild(cancelBtn);

  return { container: c };
}

// ── SEND_PENDING ────────────────────────────────────────

export function sendPendingScreen(): Screen {
  const c = new Container();
  const ctx = actor.getSnapshot().context;

  const title = createTitle("Sending...");
  title.anchor.set(0.5);
  title.x = POPUP_WIDTH / 2;
  title.y = 180;
  c.addChild(title);

  const spinner = createSpinner(40);
  spinner.x = POPUP_WIDTH / 2;
  spinner.y = 250;
  c.addChild(spinner);

  const hint = createText("Waiting for network...", {
    align: "center",
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.small,
  });
  hint.anchor.set(0.5);
  hint.x = POPUP_WIDTH / 2;
  hint.y = 300;
  c.addChild(hint);

  return {
    container: c,
    onEnter: async () => {
      try {
        const result = await wm.send(ctx.sendTo, ctx.sendAmount);
        if (result.success) {
          // Add to whitelist on successful send
          addToWhitelist(ctx.sendTo);
          sendEvent({ type: "TX_SUCCESS", txHash: "" });
        } else {
          sendEvent({ type: "TX_ERROR", error: result.error ?? "Transaction failed" });
        }
      } catch (err) {
        sendEvent({
          type: "TX_ERROR",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// ── SEND_SUCCESS ────────────────────────────────────────

export function sendSuccessScreen(): Screen {
  const c = new Container();

  const check = createText("\u2713", { fontSize: 48, color: COLORS.success, align: "center" });
  check.anchor.set(0.5);
  check.x = POPUP_WIDTH / 2;
  check.y = 140;
  c.addChild(check);

  const title = createTitle("Transaction Sent!");
  title.anchor.set(0.5);
  title.x = POPUP_WIDTH / 2;
  title.y = 200;
  c.addChild(title);

  const sub = createText("It may take a few seconds to appear in history.", {
    align: "center",
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.small,
  });
  sub.anchor.set(0.5);
  sub.x = POPUP_WIDTH / 2;
  sub.y = 240;
  c.addChild(sub);

  const doneBtn = createButton({
    label: "Done",
    onTap: () => sendEvent({ type: "DONE" }),
  });
  doneBtn.x = PADDING;
  doneBtn.y = POPUP_HEIGHT - 90;
  c.addChild(doneBtn);

  return { container: c };
}

// ── SEND_ERROR ──────────────────────────────────────────

export function sendErrorScreen(): Screen {
  const c = new Container();
  const ctx = actor.getSnapshot().context;

  const icon = createText("\u2717", { fontSize: 48, color: COLORS.danger, align: "center" });
  icon.anchor.set(0.5);
  icon.x = POPUP_WIDTH / 2;
  icon.y = 120;
  c.addChild(icon);

  const title = createTitle("Transaction Failed");
  title.anchor.set(0.5);
  title.x = POPUP_WIDTH / 2;
  title.y = 180;
  c.addChild(title);

  const errMsg = createText(ctx.sendError || "Unknown error", {
    color: COLORS.danger,
    align: "center",
    maxWidth: POPUP_WIDTH - PADDING * 2,
  });
  errMsg.anchor.set(0.5);
  errMsg.x = POPUP_WIDTH / 2;
  errMsg.y = 230;
  c.addChild(errMsg);

  const retryBtn = createButton({
    label: "Retry",
    onTap: () => sendEvent({ type: "RETRY" }),
  });
  retryBtn.x = PADDING;
  retryBtn.y = 300;
  c.addChild(retryBtn);

  const cancelBtn = createButton({
    label: "Back to Wallet",
    ...SECONDARY_BTN,
    onTap: () => sendEvent({ type: "CANCEL" }),
  });
  cancelBtn.x = PADDING;
  cancelBtn.y = 360;
  c.addChild(cancelBtn);

  return { container: c };
}
