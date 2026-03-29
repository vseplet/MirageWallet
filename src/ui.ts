import { Container, Graphics, Text, TextStyle } from "pixi.js";
import {
  POPUP_WIDTH,
  COLORS,
  FONT_FAMILY,
  FONT_SIZE,
  BUTTON_HEIGHT,
  BUTTON_RADIUS,
  INPUT_HEIGHT,
  INPUT_RADIUS,
  PADDING,
  PANEL_RADIUS,
} from "@/config";

export const SECONDARY_BTN = {
  color: COLORS.secondary,
  hoverColor: COLORS.secondaryHover,
  pressColor: COLORS.secondaryPress,
} as const;

// ── Button ──────────────────────────────────────────────

export interface ButtonOpts {
  label: string;
  width?: number;
  height?: number;
  color?: number;
  hoverColor?: number;
  pressColor?: number;
  fontSize?: number;
  onTap: () => void;
}

export function createButton(opts: ButtonOpts): Container {
  const w = opts.width ?? POPUP_WIDTH - PADDING * 2;
  const h = opts.height ?? BUTTON_HEIGHT;
  const base = opts.color ?? COLORS.accent;
  const hover = opts.hoverColor ?? COLORS.accentHover;
  const press = opts.pressColor ?? COLORS.accentPress;

  const c = new Container();
  c.eventMode = "static";
  c.cursor = "pointer";

  const bg = new Graphics();
  const draw = (color: number) => {
    bg.clear();
    bg.roundRect(0, 0, w, h, BUTTON_RADIUS);
    bg.fill(color);
  };
  draw(base);

  const label = new Text({
    text: opts.label,
    style: new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: opts.fontSize ?? FONT_SIZE.button,
      fontWeight: "bold",
      fill: "#ffffff",
    }),
  });
  label.anchor.set(0.5);
  label.x = w / 2;
  label.y = h / 2;

  c.addChild(bg);
  c.addChild(label);

  c.on("pointerover", () => draw(hover));
  c.on("pointerout", () => draw(base));
  c.on("pointerdown", () => draw(press));
  c.on("pointerup", () => {
    draw(hover);
    opts.onTap();
  });

  return c;
}

// ── Title ───────────────────────────────────────────────

export function createTitle(str: string, fontSize: number = FONT_SIZE.title): Text {
  return new Text({
    text: str,
    style: new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize,
      fontWeight: "bold",
      fill: COLORS.text,
    }),
  });
}

// ── Body Text ───────────────────────────────────────────

export function createText(
  str: string,
  opts?: { color?: number; fontSize?: number; maxWidth?: number; align?: "left" | "center" },
): Text {
  return new Text({
    text: str,
    style: new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: opts?.fontSize ?? FONT_SIZE.body,
      fill: opts?.color ?? COLORS.textDim,
      wordWrap: true,
      wordWrapWidth: opts?.maxWidth ?? POPUP_WIDTH - PADDING * 2,
      align: opts?.align ?? "left",
    }),
  });
}

// ── Panel ───────────────────────────────────────────────

export function createPanel(w: number, h: number, color: number = COLORS.panel): Graphics {
  const g = new Graphics();
  g.roundRect(0, 0, w, h, PANEL_RADIUS);
  g.fill(color);
  return g;
}

// ── Screen type ─────────────────────────────────────────

export type Screen = {
  container: Container;
  onEnter?: () => void;
  onExit?: () => void;
};

// ── HTML Input overlay ──────────────────────────────────

export function createHtmlInput(opts: {
  x: number;
  y: number;
  width: number;
  height?: number;
  placeholder?: string;
  type?: string;
  fontSize?: number;
}): HTMLInputElement {
  const input = document.createElement("input");
  input.type = opts.type ?? "text";
  input.placeholder = opts.placeholder ?? "";
  input.autocomplete = "off";
  input.spellcheck = false;
  Object.assign(input.style, {
    position: "absolute",
    left: `${opts.x}px`,
    top: `${opts.y}px`,
    width: `${opts.width}px`,
    height: `${opts.height ?? INPUT_HEIGHT}px`,
    background: `#${COLORS.inputBg.toString(16).padStart(6, "0")}`,
    border: `1px solid #${COLORS.inputBorder.toString(16).padStart(6, "0")}`,
    borderRadius: `${INPUT_RADIUS}px`,
    color: "#ffffff",
    fontSize: `${opts.fontSize ?? FONT_SIZE.body}px`,
    fontFamily: FONT_FAMILY,
    padding: "0 12px",
    outline: "none",
    boxSizing: "border-box",
  });
  document.body.appendChild(input);
  return input;
}

// ── HTML Textarea overlay ───────────────────────────────

export function createHtmlTextarea(opts: {
  x: number;
  y: number;
  width: number;
  height: number;
  placeholder?: string;
  fontSize?: number;
}): HTMLTextAreaElement {
  const ta = document.createElement("textarea");
  ta.placeholder = opts.placeholder ?? "";
  ta.autocomplete = "off";
  ta.spellcheck = false;
  Object.assign(ta.style, {
    position: "absolute",
    left: `${opts.x}px`,
    top: `${opts.y}px`,
    width: `${opts.width}px`,
    height: `${opts.height}px`,
    background: `#${COLORS.inputBg.toString(16).padStart(6, "0")}`,
    border: `1px solid #${COLORS.inputBorder.toString(16).padStart(6, "0")}`,
    borderRadius: `${INPUT_RADIUS}px`,
    color: "#ffffff",
    fontSize: `${opts.fontSize ?? FONT_SIZE.body}px`,
    fontFamily: FONT_FAMILY,
    padding: "10px 12px",
    outline: "none",
    boxSizing: "border-box",
    resize: "none",
  });
  document.body.appendChild(ta);
  return ta;
}

// ── Cleanup ─────────────────────────────────────────────

export function removeHtmlElements(...els: (HTMLElement | undefined)[]) {
  for (const el of els) el?.remove();
}

// ── Spinner ─────────────────────────────────────────────

export function createSpinner(size = 32): Container {
  const c = new Container();
  const g = new Graphics();
  g.arc(0, 0, size / 2, 0, Math.PI * 1.5);
  g.stroke({ width: 3, color: COLORS.accent });
  c.addChild(g);
  let angle = 0;
  let running = true;
  const tick = () => {
    if (!running) return;
    angle += 0.1;
    g.rotation = angle;
    requestAnimationFrame(tick);
  };
  tick();
  c.on("destroyed", () => {
    running = false;
  });
  return c;
}
