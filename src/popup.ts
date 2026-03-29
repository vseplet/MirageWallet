import "pixi.js/unsafe-eval";
import { Application } from "pixi.js";
import { POPUP_WIDTH, POPUP_HEIGHT, COLORS } from "@/config";
import { start, send, subscribe, type WalletState } from "@/state";
import { hasExistingWallet } from "@/wallet-manager";
import type { Screen } from "@/ui";

import { onboardingScreen } from "@/screens/onboarding";
import { createScreen } from "@/screens/create";
import { importScreen } from "@/screens/import";
import { setPasswordScreen, unlockScreen } from "@/screens/password";
import { dashboardScreen } from "@/screens/dashboard";
import { receiveScreen } from "@/screens/receive";
import {
  sendScreen,
  sendWarningScreen,
  sendConfirmScreen,
  sendPendingScreen,
  sendSuccessScreen,
  sendErrorScreen,
} from "@/screens/send";
import { settingsScreen } from "@/screens/settings";

const screenFactory: Record<string, () => Screen> = {
  onboarding: onboardingScreen,
  create: createScreen,
  import: importScreen,
  setPassword: setPasswordScreen,
  unlock: unlockScreen,
  dashboard: dashboardScreen,
  receive: receiveScreen,
  send: sendScreen,
  sendWarning: sendWarningScreen,
  sendConfirm: sendConfirmScreen,
  sendPending: sendPendingScreen,
  sendSuccess: sendSuccessScreen,
  sendError: sendErrorScreen,
  settings: settingsScreen,
};

async function main() {
  const app = new Application();

  await app.init({
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
    background: COLORS.bg,
    antialias: true,
  });

  document.body.appendChild(app.canvas);

  let currentScreen: Screen | null = null;

  function showScreen(stateName: string) {
    if (currentScreen) {
      currentScreen.onExit?.();
      app.stage.removeChild(currentScreen.container);
      currentScreen.container.destroy({ children: true });
    }

    const factory = screenFactory[stateName];
    if (!factory) {
      console.warn(`No screen for state: ${stateName}`);
      return;
    }

    currentScreen = factory();
    app.stage.addChild(currentScreen.container);
    currentScreen.onEnter?.();
  }

  subscribe((snapshot: WalletState) => {
    showScreen(snapshot.value as string);
  });

  start();

  // If vault exists, go to unlock; otherwise stay on onboarding
  if (hasExistingWallet()) {
    send({ type: "UNLOCK" });
  }
}

main();
