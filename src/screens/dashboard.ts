import { Container } from "pixi.js";
import { createButton, createTitle, createText, createPanel, SECONDARY_BTN, type Screen } from "@/ui";
import { send } from "@/state";
import { POPUP_WIDTH, POPUP_HEIGHT, PADDING, COLORS, FONT_SIZE, TON_TESTNET_EXPLORER, POLL_INTERVAL_MS, VK_GAP, API_THROTTLE_DELAY_MS } from "@/config";
import * as wm from "@/wallet-manager";
import { shortenAddress, type TxInfo } from "@/ton";

export function dashboardScreen(): Screen {
  const c = new Container();
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  let fullAddr = "";
  try {
    fullAddr = wm.getAddress();
  } catch { /* wallet locked */ }

  // ── Top row: address + buttons ────────────────────────

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

  const smallBtnW = 70;
  const smallBtnH = 24;
  const smallBtnStyle = {
    height: smallBtnH,
    fontSize: 11,
    ...SECONDARY_BTN,
  };

  const explorerBtn = createButton({
    label: "Tonscan \u2197",
    width: smallBtnW,
    ...smallBtnStyle,
    onTap: () => {
      window.open(`${TON_TESTNET_EXPLORER}/address/${fullAddr}`, "_blank");
    },
  });
  explorerBtn.x = POPUP_WIDTH - PADDING - smallBtnW * 2 - VK_GAP;
  explorerBtn.y = 26;
  c.addChild(explorerBtn);

  const settingsBtn = createButton({
    label: "\u2699 Settings",
    width: smallBtnW,
    ...smallBtnStyle,
    onTap: () => send({ type: "SETTINGS" }),
  });
  settingsBtn.x = POPUP_WIDTH - PADDING - smallBtnW;
  settingsBtn.y = 26;
  c.addChild(settingsBtn);

  // ── Balance ───────────────────────────────────────────

  const balance = createTitle("Loading...", 28);
  balance.anchor.set(0.5);
  balance.x = POPUP_WIDTH / 2;
  balance.y = 80;
  c.addChild(balance);

  // ── Action buttons ────────────────────────────────────

  const btnW = (POPUP_WIDTH - PADDING * 3) / 2;

  const receiveBtn = createButton({
    label: "Receive",
    width: btnW,
    onTap: () => send({ type: "RECEIVE" }),
  });
  receiveBtn.x = PADDING;
  receiveBtn.y = 108;
  c.addChild(receiveBtn);

  const sendBtn = createButton({
    label: "Send",
    width: btnW,
    onTap: () => send({ type: "SEND" }),
  });
  sendBtn.x = PADDING * 2 + btnW;
  sendBtn.y = 108;
  c.addChild(sendBtn);

  // ── Transactions ──────────────────────────────────────

  const txHeaderY = 168;
  const txPanelY = 186;
  const txPanelH = POPUP_HEIGHT - txPanelY - PADDING;

  const txTitle = createText("Transactions", {
    fontSize: FONT_SIZE.subtitle,
    color: COLORS.text,
  });
  txTitle.x = PADDING;
  txTitle.y = txHeaderY;
  c.addChild(txTitle);

  const lastUpdate = createText("", { fontSize: 10, color: COLORS.textMuted });
  lastUpdate.x = POPUP_WIDTH - PADDING - 60;
  lastUpdate.y = txHeaderY + 4;
  c.addChild(lastUpdate);

  const panel = createPanel(POPUP_WIDTH - PADDING * 2, txPanelH);
  panel.x = PADDING;
  panel.y = txPanelY;
  c.addChild(panel);

  const txListContainer = new Container();
  txListContainer.x = PADDING + 4;
  txListContainer.y = txPanelY + 8;
  c.addChild(txListContainer);

  const noTx = createText("Loading transactions...", {
    align: "center",
    color: COLORS.textMuted,
  });
  noTx.anchor.set(0.5);
  noTx.x = POPUP_WIDTH / 2;
  noTx.y = txPanelY + txPanelH / 2;
  c.addChild(noTx);

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

    const maxVisible = Math.floor((txPanelH - 16) / 34);
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
      // Keep previous
    }

    await delay(API_THROTTLE_DELAY_MS);

    try {
      const txs = await wm.fetchTransactions();
      renderTxList(txs);
    } catch {
      // Keep previous
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
