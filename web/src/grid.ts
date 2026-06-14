import { SIZE } from "./theme";

// Grid binning + render<->world conversion, used by the hotspot ranking panel.
// Points are in render space (u*SIZE, (1-v)*SIZE).

export interface Cfg { scale: number; originX: number; originZ: number; }
export interface Bbox { x0: number; y0: number; x1: number; y1: number; } // render space, x0<x1, y0<y1

// render-space pixel -> world (x,z)
export const renderToWorld = (rx: number, ry: number, cfg: Cfg): [number, number] => {
  const u = rx / SIZE;
  const v = 1 - ry / SIZE;
  return [Math.round(u * cfg.scale + cfg.originX), Math.round(v * cfg.scale + cfg.originZ)];
};

// the playable area (from world bounds) as a render-space box
export function playableBbox(wb: { xmin: number; xmax: number; zmin: number; zmax: number }, cfg: Cfg): Bbox {
  const ux0 = (wb.xmin - cfg.originX) / cfg.scale;
  const ux1 = (wb.xmax - cfg.originX) / cfg.scale;
  const vz0 = (wb.zmin - cfg.originZ) / cfg.scale;
  const vz1 = (wb.zmax - cfg.originZ) / cfg.scale;
  return { x0: ux0 * SIZE, x1: ux1 * SIZE, y0: (1 - vz1) * SIZE, y1: (1 - vz0) * SIZE };
}

export interface Binned {
  counts: number[][]; // [row=cy][col=cx]
  w: number;
  h: number;
  n: number;
  bbox: Bbox;
}

export function binGrid(points: [number, number][], bbox: Bbox, n: number): Binned {
  const counts = Array.from({ length: n }, () => new Array(n).fill(0));
  const w = (bbox.x1 - bbox.x0) / n;
  const h = (bbox.y1 - bbox.y0) / n;
  for (const [px, py] of points) {
    // Closed upper edge: a point exactly on x1/y1 (the data's own max bound) lands in the
    // last cell via the Math.min clamp below, instead of being silently dropped.
    if (px < bbox.x0 || px > bbox.x1 || py < bbox.y0 || py > bbox.y1) continue;
    const cx = Math.min(n - 1, Math.floor((px - bbox.x0) / w));
    const cy = Math.min(n - 1, Math.floor((py - bbox.y0) / h));
    counts[cy][cx]++;
  }
  return { counts, w, h, n, bbox };
}

export const cellCenter = (b: Binned, cx: number, cy: number): [number, number] => [
  b.bbox.x0 + (cx + 0.5) * b.w,
  b.bbox.y0 + (cy + 0.5) * b.h,
];

// top-N non-empty cells by count, with render center + world coords
export function topCells(b: Binned, cfg: Cfg, topN: number) {
  const out: { cx: number; cy: number; count: number; center: [number, number]; world: [number, number] }[] = [];
  for (let cy = 0; cy < b.n; cy++) {
    for (let cx = 0; cx < b.n; cx++) {
      const count = b.counts[cy][cx];
      if (count > 0) {
        const center = cellCenter(b, cx, cy);
        out.push({ cx, cy, count, center, world: renderToWorld(center[0], center[1], cfg) });
      }
    }
  }
  out.sort((a, c) => c.count - a.count);
  return out.slice(0, topN);
}
