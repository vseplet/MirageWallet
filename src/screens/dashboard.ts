import { Container, Graphics } from "pixi.js";
import { createButton, createTitle, createText, createPanel, createHtmlInput, removeHtmlElements, SECONDARY_BTN, type Screen } from "@/ui";
import { send } from "@/state";
import { POPUP_WIDTH, POPUP_HEIGHT, PADDING, COLORS, FONT_SIZE, TON_TESTNET_EXPLORER, POLL_INTERVAL_MS, VK_GAP, API_THROTTLE_DELAY_MS, S } from "@/config";
import * as wm from "@/wallet-manager";
import { shortenAddress, searchTransactions, type TxInfo } from "@/ton";

export function dashboardScreen(): Screen {
  const c = new Container();
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let searchInput: HTMLInputElement | undefined;
  let allTxs: TxInfo[] = [];

  let fullAddr = "";
  try {
    fullAddr = wm.getAddress();
  } catch { /* wallet locked */ }

  // ── Top row: address + buttons ────────────────────────

  const addrLabel = createText(S.yourAddress, { fontSize: FONT_SIZE.small, color: COLORS.textMuted });
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
    label: S.tonscan,
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
    label: S.settings,
    width: smallBtnW,
    ...smallBtnStyle,
    onTap: () => send({ type: "SETTINGS" }),
  });
  settingsBtn.x = POPUP_WIDTH - PADDING - smallBtnW;
  settingsBtn.y = 26;
  c.addChild(settingsBtn);

  // ── Balance (hidden until hover) ──────────────────────

  let realBalance = "0.00";
  const hiddenBalance = S.hiddenBalance;

  const balanceContainer = new Container();
  balanceContainer.eventMode = "static";
  balanceContainer.cursor = "default";
  balanceContainer.x = 0;
  balanceContainer.y = 60;

  // Hit area for the whole balance row
  const balanceHit = new Graphics();
  balanceHit.rect(0, 0, POPUP_WIDTH, 36);
  balanceHit.fill({ color: 0x000000, alpha: 0.001 });
  balanceContainer.addChild(balanceHit);

  const balance = createTitle(hiddenBalance, FONT_SIZE.balance);
  balance.anchor.set(0.5);
  balance.x = POPUP_WIDTH / 2;
  balance.y = 18;
  balanceContainer.addChild(balance);

  balanceContainer.on("pointerover", () => {
    balance.text = `${realBalance} TON`;
  });
  balanceContainer.on("pointerout", () => {
    balance.text = hiddenBalance;
  });

  c.addChild(balanceContainer);

  // ── Action buttons ────────────────────────────────────

  const btnW = (POPUP_WIDTH - PADDING * 3) / 2;

  const receiveBtn = createButton({
    label: S.receive,
    width: btnW,
    onTap: () => send({ type: "RECEIVE" }),
  });
  receiveBtn.x = PADDING;
  receiveBtn.y = 108;
  c.addChild(receiveBtn);

  const sendBtn = createButton({
    label: S.send,
    width: btnW,
    onTap: () => send({ type: "SEND" }),
  });
  sendBtn.x = PADDING * 2 + btnW;
  sendBtn.y = 108;
  c.addChild(sendBtn);

  // ── Transactions ──────────────────────────────────────

  const txHeaderY = 168;
  const searchY = txHeaderY + 20;
  const txPanelY = searchY + 34;
  const txPanelH = POPUP_HEIGHT - txPanelY - PADDING;

  const txTitle = createText(S.transactions, {
    fontSize: FONT_SIZE.subtitle,
    color: COLORS.text,
  });
  txTitle.x = PADDING;
  txTitle.y = txHeaderY;
  c.addChild(txTitle);

  const lastUpdate = createText("", { fontSize: FONT_SIZE.tiny, color: COLORS.textMuted });
  lastUpdate.x = POPUP_WIDTH - PADDING - 60;
  lastUpdate.y = txHeaderY + 4;
  c.addChild(lastUpdate);

  const panel = createPanel(POPUP_WIDTH - PADDING * 2, txPanelH);
  panel.x = PADDING;
  panel.y = txPanelY;
  c.addChild(panel);

  const txListContainer = new Container();
  txListContainer.x = PADDING + 4;
  txListContainer.y = txPanelY + 6;
  c.addChild(txListContainer);

  const noTx = createText(S.loadingTx, {
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
      noTx.text = allTxs.length === 0 ? S.noTransactions : S.noMatches;
      noTx.visible = true;
      return;
    }
    noTx.visible = false;

    const maxVisible = Math.floor((txPanelH - 12) / 32);
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
      line.y = i * 32;
      txListContainer.addChild(line);

      if (tx.comment) {
        const cmt = createText(tx.comment, {
          fontSize: FONT_SIZE.tiny,
          color: COLORS.textMuted,
          maxWidth: POPUP_WIDTH - PADDING * 4,
        });
        cmt.x = 0;
        cmt.y = i * 32 + 14;
        txListContainer.addChild(cmt);
      }
    }
  }

  function applySearch() {
    const query = searchInput?.value ?? "";
    const filtered = searchTransactions(allTxs, query);
    renderTxList(filtered);
  }

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function refresh() {
    try {
      realBalance = await wm.fetchBalance();
    } catch {
      // Keep previous
    }

    await delay(API_THROTTLE_DELAY_MS);

    try {
      allTxs = await wm.fetchTransactions();
      applySearch();
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
      // Search input
      searchInput = createHtmlInput({
        x: PADDING,
        y: searchY,
        width: POPUP_WIDTH - PADDING * 2,
        height: 28,
        placeholder: S.searchPlaceholder,
        fontSize: FONT_SIZE.small,
      });
      searchInput.addEventListener("input", applySearch);

      await refresh();
      pollTimer = setInterval(refresh, POLL_INTERVAL_MS);
    },
    onExit: () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      removeHtmlElements(searchInput);
      searchInput = undefined;
    },
  };
}
