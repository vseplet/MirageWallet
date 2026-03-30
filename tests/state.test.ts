import { describe, test, expect } from "bun:test";
import { createActor } from "xstate";
import { walletMachine } from "@/state";

function createTestActor() {
  const actor = createActor(walletMachine);
  actor.start();
  return actor;
}

function getState(actor: ReturnType<typeof createTestActor>): string {
  return actor.getSnapshot().value as string;
}

// ── Initial State ───────────────────────────────────────

describe("initial state", () => {
  test("starts at onboarding", () => {
    const actor = createTestActor();
    expect(getState(actor)).toBe("onboarding");
  });
});

// ── Onboarding Transitions ──────────────────────────────

describe("onboarding", () => {
  test("CREATE -> create", () => {
    const actor = createTestActor();
    actor.send({ type: "CREATE" });
    expect(getState(actor)).toBe("create");
  });

  test("IMPORT -> import", () => {
    const actor = createTestActor();
    actor.send({ type: "IMPORT" });
    expect(getState(actor)).toBe("import");
  });

  test("UNLOCK -> unlock", () => {
    const actor = createTestActor();
    actor.send({ type: "UNLOCK" });
    expect(getState(actor)).toBe("unlock");
  });

  test("ignores unknown events", () => {
    const actor = createTestActor();
    actor.send({ type: "SEND" });
    expect(getState(actor)).toBe("onboarding");
  });
});

// ── Create Flow ─────────────────────────────────────────

describe("create flow", () => {
  test("create -> MNEMONIC_CONFIRMED -> setPassword", () => {
    const actor = createTestActor();
    actor.send({ type: "CREATE" });
    actor.send({ type: "MNEMONIC_CONFIRMED", mnemonic: ["word1", "word2"] });
    expect(getState(actor)).toBe("setPassword");
    expect(actor.getSnapshot().context.mnemonic).toEqual(["word1", "word2"]);
  });

  test("create -> BACK -> onboarding", () => {
    const actor = createTestActor();
    actor.send({ type: "CREATE" });
    actor.send({ type: "BACK" });
    expect(getState(actor)).toBe("onboarding");
  });

  test("setPassword -> PASSWORD_SET -> dashboard", () => {
    const actor = createTestActor();
    actor.send({ type: "CREATE" });
    actor.send({ type: "MNEMONIC_CONFIRMED", mnemonic: [] });
    actor.send({ type: "PASSWORD_SET" });
    expect(getState(actor)).toBe("dashboard");
  });
});

// ── Import Flow ─────────────────────────────────────────

describe("import flow", () => {
  test("import -> MNEMONIC_VALID -> setPassword", () => {
    const actor = createTestActor();
    actor.send({ type: "IMPORT" });
    actor.send({ type: "MNEMONIC_VALID", mnemonic: ["a", "b", "c"] });
    expect(getState(actor)).toBe("setPassword");
    expect(actor.getSnapshot().context.mnemonic).toEqual(["a", "b", "c"]);
  });

  test("import -> BACK -> onboarding", () => {
    const actor = createTestActor();
    actor.send({ type: "IMPORT" });
    actor.send({ type: "BACK" });
    expect(getState(actor)).toBe("onboarding");
  });
});

// ── Unlock Flow ─────────────────────────────────────────

describe("unlock flow", () => {
  test("unlock -> UNLOCK -> dashboard", () => {
    const actor = createTestActor();
    actor.send({ type: "UNLOCK" });
    actor.send({ type: "UNLOCK" });
    expect(getState(actor)).toBe("dashboard");
  });

  test("unlock -> RESET -> onboarding", () => {
    const actor = createTestActor();
    actor.send({ type: "UNLOCK" });
    actor.send({ type: "RESET" });
    expect(getState(actor)).toBe("onboarding");
  });
});

// ── Dashboard Navigation ────────────────────────────────

describe("dashboard navigation", () => {
  function toDashboard() {
    const actor = createTestActor();
    actor.send({ type: "CREATE" });
    actor.send({ type: "MNEMONIC_CONFIRMED", mnemonic: [] });
    actor.send({ type: "PASSWORD_SET" });
    return actor;
  }

  test("RECEIVE -> receive -> BACK -> dashboard", () => {
    const actor = toDashboard();
    actor.send({ type: "RECEIVE" });
    expect(getState(actor)).toBe("receive");
    actor.send({ type: "BACK" });
    expect(getState(actor)).toBe("dashboard");
  });

  test("SEND -> send -> BACK -> dashboard", () => {
    const actor = toDashboard();
    actor.send({ type: "SEND" });
    expect(getState(actor)).toBe("send");
    actor.send({ type: "BACK" });
    expect(getState(actor)).toBe("dashboard");
  });

  test("SETTINGS -> settings -> BACK -> dashboard", () => {
    const actor = toDashboard();
    actor.send({ type: "SETTINGS" });
    expect(getState(actor)).toBe("settings");
    actor.send({ type: "BACK" });
    expect(getState(actor)).toBe("dashboard");
  });

  test("LOCK -> unlock", () => {
    const actor = toDashboard();
    actor.send({ type: "LOCK" });
    expect(getState(actor)).toBe("unlock");
  });

  test("settings -> RESET -> onboarding", () => {
    const actor = toDashboard();
    actor.send({ type: "SETTINGS" });
    actor.send({ type: "RESET" });
    expect(getState(actor)).toBe("onboarding");
  });
});

// ── Send Flow ───────────────────────────────────────────

describe("send flow", () => {
  function toSend() {
    const actor = createTestActor();
    actor.send({ type: "CREATE" });
    actor.send({ type: "MNEMONIC_CONFIRMED", mnemonic: [] });
    actor.send({ type: "PASSWORD_SET" });
    actor.send({ type: "SEND" });
    return actor;
  }

  test("SUBMIT_SEND -> sendConfirm (stores to/amount)", () => {
    const actor = toSend();
    actor.send({ type: "SUBMIT_SEND", to: "EQAddr", amount: "1.5" });
    expect(getState(actor)).toBe("sendConfirm");
    expect(actor.getSnapshot().context.sendTo).toBe("EQAddr");
    expect(actor.getSnapshot().context.sendAmount).toBe("1.5");
  });

  test("WARNING_DETECTED -> sendWarning (stores warnings + to/amount)", () => {
    const actor = toSend();
    actor.send({
      type: "WARNING_DETECTED",
      warnings: ["New address"],
      to: "EQAddr",
      amount: "2.0",
    });
    expect(getState(actor)).toBe("sendWarning");
    expect(actor.getSnapshot().context.sendWarnings).toEqual(["New address"]);
    expect(actor.getSnapshot().context.sendTo).toBe("EQAddr");
  });

  test("sendWarning -> SEND_ANYWAY -> sendConfirm", () => {
    const actor = toSend();
    actor.send({ type: "WARNING_DETECTED", warnings: ["test"], to: "X", amount: "1" });
    actor.send({ type: "SEND_ANYWAY" });
    expect(getState(actor)).toBe("sendConfirm");
  });

  test("sendWarning -> CANCEL -> send", () => {
    const actor = toSend();
    actor.send({ type: "WARNING_DETECTED", warnings: ["test"], to: "X", amount: "1" });
    actor.send({ type: "CANCEL" });
    expect(getState(actor)).toBe("send");
  });

  test("sendConfirm -> CONFIRM -> sendPending", () => {
    const actor = toSend();
    actor.send({ type: "SUBMIT_SEND", to: "X", amount: "1" });
    actor.send({ type: "CONFIRM" });
    expect(getState(actor)).toBe("sendPending");
  });

  test("sendConfirm -> CANCEL -> send", () => {
    const actor = toSend();
    actor.send({ type: "SUBMIT_SEND", to: "X", amount: "1" });
    actor.send({ type: "CANCEL" });
    expect(getState(actor)).toBe("send");
  });

  test("sendPending -> TX_SUCCESS -> sendSuccess -> DONE -> dashboard", () => {
    const actor = toSend();
    actor.send({ type: "SUBMIT_SEND", to: "X", amount: "1" });
    actor.send({ type: "CONFIRM" });
    actor.send({ type: "TX_SUCCESS", txHash: "abc123" });
    expect(getState(actor)).toBe("sendSuccess");
    expect(actor.getSnapshot().context.sendTxHash).toBe("abc123");
    actor.send({ type: "DONE" });
    expect(getState(actor)).toBe("dashboard");
  });

  test("sendPending -> TX_ERROR -> sendError", () => {
    const actor = toSend();
    actor.send({ type: "SUBMIT_SEND", to: "X", amount: "1" });
    actor.send({ type: "CONFIRM" });
    actor.send({ type: "TX_ERROR", error: "timeout" });
    expect(getState(actor)).toBe("sendError");
    expect(actor.getSnapshot().context.sendError).toBe("timeout");
  });

  test("sendError -> RETRY -> sendConfirm", () => {
    const actor = toSend();
    actor.send({ type: "SUBMIT_SEND", to: "X", amount: "1" });
    actor.send({ type: "CONFIRM" });
    actor.send({ type: "TX_ERROR", error: "fail" });
    actor.send({ type: "RETRY" });
    expect(getState(actor)).toBe("sendConfirm");
  });

  test("sendError -> CANCEL -> dashboard", () => {
    const actor = toSend();
    actor.send({ type: "SUBMIT_SEND", to: "X", amount: "1" });
    actor.send({ type: "CONFIRM" });
    actor.send({ type: "TX_ERROR", error: "fail" });
    actor.send({ type: "CANCEL" });
    expect(getState(actor)).toBe("dashboard");
  });
});

// ── Invalid Transitions ─────────────────────────────────

describe("invalid transitions stay in current state", () => {
  test("dashboard ignores CONFIRM", () => {
    const actor = createTestActor();
    actor.send({ type: "CREATE" });
    actor.send({ type: "MNEMONIC_CONFIRMED", mnemonic: [] });
    actor.send({ type: "PASSWORD_SET" });
    actor.send({ type: "CONFIRM" });
    expect(getState(actor)).toBe("dashboard");
  });

  test("receive ignores SEND", () => {
    const actor = createTestActor();
    actor.send({ type: "CREATE" });
    actor.send({ type: "MNEMONIC_CONFIRMED", mnemonic: [] });
    actor.send({ type: "PASSWORD_SET" });
    actor.send({ type: "RECEIVE" });
    actor.send({ type: "SEND" });
    expect(getState(actor)).toBe("receive");
  });

  test("sendPending ignores BACK", () => {
    const actor = createTestActor();
    actor.send({ type: "CREATE" });
    actor.send({ type: "MNEMONIC_CONFIRMED", mnemonic: [] });
    actor.send({ type: "PASSWORD_SET" });
    actor.send({ type: "SEND" });
    actor.send({ type: "SUBMIT_SEND", to: "X", amount: "1" });
    actor.send({ type: "CONFIRM" });
    actor.send({ type: "BACK" });
    expect(getState(actor)).toBe("sendPending");
  });
});
