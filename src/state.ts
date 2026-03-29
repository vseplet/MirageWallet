import { createActor, setup, type SnapshotFrom } from "xstate";

export const walletMachine = setup({
  types: {
    context: {} as {
      mnemonic: string[];
      sendTo: string;
      sendAmount: string;
      sendWarnings: string[];
      sendTxHash: string;
      sendError: string;
    },
    events: {} as
      | { type: "CREATE" }
      | { type: "IMPORT" }
      | { type: "MNEMONIC_CONFIRMED"; mnemonic: string[] }
      | { type: "MNEMONIC_VALID"; mnemonic: string[] }
      | { type: "PASSWORD_SET" }
      | { type: "UNLOCK" }
      | { type: "RESET" }
      | { type: "RECEIVE" }
      | { type: "SEND" }
      | { type: "SETTINGS" }
      | { type: "BACK" }
      | { type: "SUBMIT_SEND"; to: string; amount: string }
      | { type: "WARNING_DETECTED"; warnings: string[]; to: string; amount: string }
      | { type: "SEND_CLEAN" }
      | { type: "SEND_ANYWAY" }
      | { type: "CONFIRM" }
      | { type: "CANCEL" }
      | { type: "TX_SUCCESS"; txHash: string }
      | { type: "TX_ERROR"; error: string }
      | { type: "RETRY" }
      | { type: "DONE" }
      | { type: "LOCK" },
  },
}).createMachine({
  id: "wallet",
  initial: "onboarding",
  context: {
    mnemonic: [],
    sendTo: "",
    sendAmount: "",
    sendWarnings: [],
    sendTxHash: "",
    sendError: "",
  },
  states: {
    onboarding: {
      on: {
        CREATE: "create",
        IMPORT: "import",
        UNLOCK: "unlock",
      },
    },

    create: {
      on: {
        MNEMONIC_CONFIRMED: {
          target: "setPassword",
          actions: ({ context, event }) => {
            context.mnemonic = event.mnemonic;
          },
        },
        BACK: "onboarding",
      },
    },

    import: {
      on: {
        MNEMONIC_VALID: {
          target: "setPassword",
          actions: ({ context, event }) => {
            context.mnemonic = event.mnemonic;
          },
        },
        BACK: "onboarding",
      },
    },

    setPassword: {
      on: {
        PASSWORD_SET: "dashboard",
      },
    },

    unlock: {
      on: {
        UNLOCK: "dashboard",
        RESET: "onboarding",
      },
    },

    dashboard: {
      on: {
        RECEIVE: "receive",
        SEND: "send",
        SETTINGS: "settings",
        LOCK: "unlock",
      },
    },

    receive: {
      on: {
        BACK: "dashboard",
      },
    },

    send: {
      on: {
        WARNING_DETECTED: {
          target: "sendWarning",
          actions: ({ context, event }) => {
            context.sendWarnings = event.warnings;
            context.sendTo = event.to;
            context.sendAmount = event.amount;
          },
        },
        SUBMIT_SEND: {
          target: "sendConfirm",
          actions: ({ context, event }) => {
            context.sendTo = event.to;
            context.sendAmount = event.amount;
          },
        },
        BACK: "dashboard",
      },
    },

    sendWarning: {
      on: {
        SEND_ANYWAY: "sendConfirm",
        CANCEL: "send",
      },
    },

    sendConfirm: {
      on: {
        CONFIRM: "sendPending",
        CANCEL: "send",
      },
    },

    sendPending: {
      on: {
        TX_SUCCESS: {
          target: "sendSuccess",
          actions: ({ context, event }) => {
            context.sendTxHash = event.txHash;
          },
        },
        TX_ERROR: {
          target: "sendError",
          actions: ({ context, event }) => {
            context.sendError = event.error;
          },
        },
      },
    },

    sendSuccess: {
      on: {
        DONE: "dashboard",
      },
    },

    sendError: {
      on: {
        RETRY: "sendConfirm",
        CANCEL: "dashboard",
      },
    },

    settings: {
      on: {
        BACK: "dashboard",
        RESET: "onboarding",
      },
    },
  },
});

// ── Actor ────────────────────────────────────────────────

export const actor = createActor(walletMachine);

export type WalletState = SnapshotFrom<typeof walletMachine>;

export function currentState(): string {
  return actor.getSnapshot().value as string;
}

export function send(event: Parameters<typeof actor.send>[0]) {
  actor.send(event);
}

export function subscribe(fn: (state: WalletState) => void) {
  return actor.subscribe(fn);
}

export function start() {
  actor.start();
}
