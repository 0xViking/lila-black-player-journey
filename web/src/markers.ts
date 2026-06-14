import { EVENT_COLORS } from "./theme";
import type { EventCategory } from "./types";

// Builds a canvas icon atlas with one distinct, outlined glyph per event category.
// Using a generated atlas (instead of a font TextLayer) guarantees the shapes render
// regardless of which characters a font happens to include.

const CATS: EventCategory[] = ["kill", "death", "storm", "loot"];
const CELL = 128;
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;
const DARK = "rgba(8,10,18,0.95)";

export interface MarkerAtlas {
  atlas: string; // PNG data URL (deck.gl IconLayer accepts a URL string)
  mapping: Record<string, { x: number; y: number; width: number; height: number; anchorX: number; anchorY: number; mask: boolean }>;
}

export function buildMarkerAtlas(): MarkerAtlas {
  const canvas = document.createElement("canvas");
  canvas.width = CELL * CATS.length;
  canvas.height = CELL;
  const ctx = canvas.getContext("2d")!;
  const mapping: MarkerAtlas["mapping"] = {};

  CATS.forEach((cat, i) => {
    const ox = i * CELL;
    drawGlyph(ctx, cat, ox + CELL / 2, CELL / 2, rgb(EVENT_COLORS[cat]));
    mapping[cat] = { x: ox, y: 0, width: CELL, height: CELL, anchorX: CELL / 2, anchorY: CELL / 2, mask: false };
  });
  return { atlas: canvas.toDataURL("image/png"), mapping };
}

function drawGlyph(ctx: CanvasRenderingContext2D, cat: EventCategory, cx: number, cy: number, color: string) {
  const r = 40;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const stroke = (w: number, col: string, draw: () => void) => { ctx.lineWidth = w; ctx.strokeStyle = col; ctx.beginPath(); draw(); ctx.stroke(); };
  const fill = (col: string, draw: () => void) => { ctx.fillStyle = col; ctx.beginPath(); draw(); ctx.fill(); };

  if (cat === "loot") {
    const diamond = () => { ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath(); };
    stroke(14, DARK, diamond); // dark outline
    fill(color, diamond);
  } else if (cat === "death") {
    const d = r * 0.78;
    const x = () => { ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d); };
    stroke(22, DARK, x);
    stroke(11, color, x);
  } else if (cat === "kill") {
    const ring = () => ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    const plus = () => { ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); };
    stroke(20, DARK, plus);
    stroke(18, DARK, ring);
    stroke(9, color, plus);
    stroke(8, color, ring);
  } else {
    // storm: 6-point burst
    const burst = (len: number) => { for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); } };
    stroke(22, DARK, () => burst(r));
    stroke(10, color, () => burst(r));
  }
}
