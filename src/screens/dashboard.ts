import { Container } from "pixi.js";
import { createButton, createTitle, createText, createPanel, type Screen } from "@/ui";
import { send } from "@/state";
import { POPUP_WIDTH, PADDING, COLORS, FONT_SIZE, TON_TESTNET_EXPLORER, POLL_INTERVAL_MS } from "@/config";
import * as wm from "@/wallet-manager";
import { shortenAddress, type TxInfo } from "@/ton";

export function dashboardScreen(): Screen {
  const c = new Container();
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  let fullAddr = "";
  try {
    fullAddr = wm.getAddress();
  } catch { /* wallet locked */ }

  // ── Address row ───────────────────────────────────────

  const addrLabel = createText("Your address", { fontSize: FONT_SIZE.small, color: COLORS.textMuted });
  addrLabel.x = PADDING;
  addrLabel.y = 12;
  c.addChild(addrLabel);

  const addr = createText(shortenAddress(fullAddr, 10, 8), {
    fontSize: FONT_SIZE.small,
    color: COLORS.text,
  });
  addr.x = PADDING;
  addr.y = 28;
  c.addChild(addr);

  const explorerBtn = createButton({
    label: "Tonscan \u2197",
    width: 90,
    height: 24,
    fontSize: 11,
    color: 0x16213e,
    hoverColor: 0x1a2744,
    pressColor: 0x0f1a2e,
    onTap: () => {
      const url = `${TON_TESTNET_EXPLORER}/address/${fullAddr}`;
      window.open(url, "_blank");
    },
  });
  explorerBtn.x = POPUP_WIDTH - PADDING - 90;
  explorerBtn.y = 26;
  c.addChild(explorerBtn);

  // ── Balance ───────────────────────────────────────────

  const balance = createTitle("Loading...", 28);
  balance.anchor.set(0.5);
  balance.x = POPUP_WIDTH / 2;
  balance.y = 72;
  c.addChild(balance);

  // ── Action buttons ────────────────────────────────────

  const btnW = (POPUP_WIDTH - PADDING * 3) / 2;

  const receiveBtn = createButton({
    label: "Receive",
    width: btnW,
    onTap: () => send({ type: "RECEIVE" }),
  });
  receiveBtn.x = PADDING;
  receiveBtn.y = 100;
  c.addChild(receiveBtn);

  const sendBtn = createButton({
    label: "Send",
    width: btnW,
    onTap: () => send({ type: "SEND" }),
  });
  sendBtn.x = PADDING * 2 + btnW;
  sendBtn.y = 100;
  c.addChild(sendBtn);

  // ── Transactions ──────────────────────────────────────

  const txTitle = createText("Transactions", {
    fontSize: FONT_SIZE.subtitle,
    color: COLORS.text,
  });
  txTitle.x = PADDING;
  txTitle.y = 162;
  c.addChild(txTitle);

  const lastUpdate = createText("", { fontSize: 10, color: COLORS.textMuted });
  lastUpdate.x = POPUP_WIDTH - PADDING - 60;
  lastUpdate.y = 166;
  c.addChild(lastUpdate);

  const panel = createPanel(POPUP_WIDTH - PADDING * 2, 250);
  panel.x = PADDING;
  panel.y = 184;
  c.addChild(panel);

  const txListContainer = new Container();
  txListContainer.x = PADDING + 4;
  txListContainer.y = 192;
  c.addChild(txListContainer);

  const noTx = createText("Loading transactions...", {
    align: "center",
    color: COLORS.textMuted,
  });
  noTx.anchor.set(0.5);
  noTx.x = POPUP_WIDTH / 2;
  noTx.y = 310;
  c.addChild(noTx);

  // ── Settings ──────────────────────────────────────────

  const settingsBtn = createButton({
    label: "Settings",
    height: 32,
    fontSize: FONT_SIZE.small,
    color: 0x16213e,
    hoverColor: 0x1a2744,
    pressColor: 0x0f1a2e,
    onTap: () => send({ type: "SETTINGS" }),
  });
  settingsBtn.x = PADDING;
  settingsBtn.y = 456;
  c.addChild(settingsBtn);

  // ── Render helpers ────────────────────────────────────

  function renderTxList(txs: TxInfo[]) {
    while (txListContainer.children.length) {
      txListContainer.removeChildAt(0);
    }

    if (txs.length === 0) {
      noTx.text = "No transactions yet";
      noTx.visible = true;
      return;
    }
    noTx.visible = false;

    const maxVisible = 7;
    const show = txs.slice(0, maxVisible);
    for (let i = 0; i < show.length; i++) {
      const tx = show[i]!;
      const prefix = tx.incoming ? "\u2B07 +" : "\u2B06 -";
      const color = tx.incoming ? COLORS.success : COLORS.text;
      const peer = tx.incoming ? tx.from : tx.to;

      const line = createText(
        `${prefix}${tx.amount} TON  ${shortenAddress(peer, 6, 4)}`,
        { fontSize: FONT_SIZE.small, color },
      );
      line.x = 0;
      line.y = i * 34;
      txListContainer.addChild(line);

      if (tx.comment) {
        const cmt = createText(tx.comment, {
          fontSize: 10,
          color: COLORS.textMuted,
          maxWidth: POPUP_WIDTH - PADDING * 4,
        });
        cmt.x = 0;
        cmt.y = i * 34 + 15;
        txListContainer.addChild(cmt);
      }
    }
  }

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function refresh() {
    try {
      const bal = await wm.fetchBalance();
      balance.text = `${bal} TON`;
    } catch {
      // Keep previous balance text on error
    }

    await delay(1500);

    try {
      const txs = await wm.fetchTransactions();
      renderTxList(txs);
    } catch {
      // Keep previous tx list on error
    }

    const now = new Date();
    lastUpdate.text = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
  }

  // ── Lifecycle ─────────────────────────────────────────

  return {
    container: c,
    onEnter: async () => {
      await refresh();
      pollTimer = setInterval(refresh, POLL_INTERVAL_MS);
    },
    onExit: () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    },
  };
}
