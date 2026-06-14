import { EVENT_COLORS, HUMAN_COLOR } from "./theme";

export type HotspotMetric = "traffic" | "kill" | "death" | "loot";

export interface HotCell {
  count: number;
  center: [number, number];
  world: [number, number];
}

const METRICS: { id: HotspotMetric; label: string }[] = [
  { id: "traffic", label: "Traffic" },
  { id: "kill", label: "Kills" },
  { id: "death", label: "Deaths" },
  { id: "loot", label: "Loot" },
];
const NOUN: Record<HotspotMetric, string> = { traffic: "movement samples", kill: "kills", death: "deaths", loot: "loot pickups" };
const color = (m: HotspotMetric) => (m === "traffic" ? HUMAN_COLOR : EVENT_COLORS[m]);
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

interface Props {
  metric: HotspotMetric;
  setMetric: (m: HotspotMetric) => void;
  cells: HotCell[];
  worldCell: number;
  selected: number;
  live: boolean;
  onFocus: (xy: [number, number], index: number) => void;
  onClose: () => void;
}

export default function Hotspots(p: Props) {
  return (
    <div className="hotspots">
      <div className="hs-head">
        <span>Hotspots{p.live && <span className="hs-live"> ● live</span>}</span>
        <button className="hs-close" aria-label="Close hotspots" onClick={p.onClose}>×</button>
      </div>
      <div className="hs-tabs">
        {METRICS.map((m) => (
          <button key={m.id} className={`hs-tab ${p.metric === m.id ? "active" : ""}`} onClick={() => p.setMetric(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      {p.cells.length === 0 ? (
        <div className="hs-empty">No {NOUN[p.metric]} {p.live ? "yet at this time." : "in the current view."}</div>
      ) : (
        <ol className="hs-list">
          {p.cells.map((c, i) => (
            <li key={i}>
              <button
                className={`hs-row ${p.selected === i ? "sel" : ""}`}
                onClick={() => p.onFocus(c.center, i)}
                title="Zoom to this spot"
              >
                <span className="hs-rank" style={{ color: rgb(color(p.metric)) }}>{i + 1}</span>
                <span className="hs-coord">({c.world[0]}, {c.world[1]})</span>
                <span className="hs-count">{c.count.toLocaleString()}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="hs-foot">
        {NOUN[p.metric]} · counted per ≈{p.worldCell}u cell · click to zoom
      </div>
    </div>
  );
}
