import type { EventCategory } from "./types";

// Logical render space: the minimap occupies a 1024x1024 square.
// World (x,z) -> UV (0..1) is done in the ETL. Here UV -> render pixels:
//   px = u * SIZE,  py = (1 - v) * SIZE   (Y flipped: image origin is top-left)
export const SIZE = 1024;

export const uvToXY = (u: number, v: number): [number, number] => [u * SIZE, (1 - v) * SIZE];

export type RGBA = [number, number, number, number];

export const HUMAN_COLOR: RGBA = [56, 189, 248, 255]; // sky-400
export const BOT_COLOR: RGBA = [244, 114, 182, 255]; // pink-400

export const EVENT_COLORS: Record<EventCategory, RGBA> = {
  kill: [74, 222, 128, 255], // green-400  - a kill was dealt
  death: [248, 113, 113, 255], // red-400   - a player died
  storm: [167, 139, 250, 255], // violet-400 - storm death
  loot: [250, 204, 21, 255], // yellow-400 - item pickup
};

export const EVENT_GLYPH: Record<EventCategory, string> = {
  kill: "✛", // crosshair-ish
  death: "✖",
  storm: "✦",
  loot: "◆",
};

export const EVENT_LABEL: Record<EventCategory, string> = {
  kill: "Kill (dealt)",
  death: "Death",
  storm: "Storm death",
  loot: "Loot pickup",
};

export const withAlpha = (c: RGBA, a: number): RGBA => [c[0], c[1], c[2], a];
