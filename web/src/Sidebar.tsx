import type { Manifest, MapId, MatchMeta } from "./types";
import type { EventToggles, HeatmapMode, TrailMode } from "./prepare";
import { EVENT_COLORS, EVENT_LABEL, HUMAN_COLOR, BOT_COLOR } from "./theme";
import type { EventCategory } from "./types";

const MAP_LABELS: Record<MapId, string> = {
  AmbroseValley: "Ambrose Valley",
  GrandRift: "Grand Rift",
  Lockdown: "Lockdown",
};
const rgba = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;
const shortDate = (d: string) => d.replace("February_", "Feb ");
const HEATS: { id: HeatmapMode; label: string }[] = [
  { id: "none", label: "Off" },
  { id: "traffic", label: "Traffic" },
  { id: "kill", label: "Kills" },
  { id: "death", label: "Deaths" },
  { id: "loot", label: "Loot" },
];

interface Props {
  open: boolean; // mobile drawer state (ignored ≥860px)
  manifest: Manifest;
  mapId: MapId;
  setMapId: (m: MapId) => void;
  dates: Set<string>;
  setDates: (s: Set<string>) => void;
  matchId: string | null;
  setMatchId: (m: string | null) => void;
  matchOptions: MatchMeta[];
  selectedMatch: MatchMeta | null;
  multiOnly: boolean;
  setMultiOnly: (b: boolean) => void;
  showHumans: boolean;
  setShowHumans: (b: boolean) => void;
  showBots: boolean;
  setShowBots: (b: boolean) => void;
  showPaths: boolean;
  setShowPaths: (b: boolean) => void;
  eventToggles: EventToggles;
  setEventToggles: (e: EventToggles) => void;
  heatmap: HeatmapMode;
  setHeatmap: (h: HeatmapMode) => void;
  heatmapOnly: boolean;
  setHeatmapOnly: (b: boolean) => void;
  hotspotsOpen: boolean;
  setHotspotsOpen: (b: boolean) => void;
  showSurvival: boolean;
  setShowSurvival: (b: boolean) => void;
  pinMode: boolean;
  setPinMode: (b: boolean) => void;
  pinCount: number;
  onClearPins: () => void;
  trailMode: TrailMode;
  setTrailMode: (t: TrailMode) => void;
  filteredCount: number;
  eventCount: number;
}

export default function Sidebar(p: Props) {
  const meta = p.manifest.maps[p.mapId];
  const toggleDate = (d: string) => {
    const next = new Set(p.dates);
    next.has(d) ? next.delete(d) : next.add(d);
    p.setDates(next);
  };
  const toggleEvent = (c: EventCategory) =>
    p.setEventToggles({ ...p.eventToggles, [c]: !p.eventToggles[c] });

  return (
    <aside className={`sidebar ${p.open ? "open" : ""}`}>
      <Section title="Map">
        <div className="seg">
          {(Object.keys(MAP_LABELS) as MapId[]).map((m) => (
            <button key={m} className={`seg-btn ${p.mapId === m ? "active" : ""}`} onClick={() => p.setMapId(m)}>
              {MAP_LABELS[m]}
            </button>
          ))}
        </div>
        <div className="map-meta" title="telemetry rows = every movement sample + every discrete event">
          {meta.matches} matches · {meta.journeys} journeys · {meta.rows.toLocaleString()} rows
        </div>
      </Section>

      <Section title="Date">
        <div className="chips">
          <button className={`chip ${p.dates.size === 0 ? "active" : ""}`} onClick={() => p.setDates(new Set())}>All</button>
          {p.manifest.dates.map((d) => (
            <button key={d} className={`chip ${p.dates.has(d) ? "active" : ""}`} onClick={() => toggleDate(d)}>
              {shortDate(d)}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Match">
        <label className="row-check small">
          <input type="checkbox" checked={p.multiOnly} onChange={(e) => p.setMultiOnly(e.target.checked)} />
          Multiplayer only (≥7 players)
        </label>
        <select
          className="match-select"
          aria-label="Select a match"
          value={p.matchId ?? ""}
          onChange={(e) => p.setMatchId(e.target.value || null)}
        >
          <option value="">All matches ({p.matchOptions.length})</option>
          {p.matchOptions.slice(0, 400).map((m) => (
            <option key={m.match_id} value={m.match_id}>
              {m.match_id.slice(0, 8)} · {shortDate(m.date)} · {m.players}p
              {m.players >= 7 ? " ★" : ""} · {m.loot}L/{m.kills}K
            </option>
          ))}
        </select>
        {p.selectedMatch && (
          <div className="match-info" title="kills & deaths count all combat in the match, including bot-vs-bot - this dataset is PvE-heavy, so most of these are humans/bots fighting bots, not each other">
            <b>{p.selectedMatch.players}</b> players ({p.selectedMatch.humans}h / {p.selectedMatch.bots}b) ·{" "}
            <b>{p.selectedMatch.loot}</b> loot · <b>{p.selectedMatch.kills}</b> kills · <b>{p.selectedMatch.deaths}</b> deaths
            {p.selectedMatch.storm ? <> · <b>{p.selectedMatch.storm}</b> storm</> : null} · {p.selectedMatch.dur}s
            <span className="combat-note">kills/deaths include bot-vs-bot</span>
            <button className="link-btn" onClick={() => p.setMatchId(null)}>clear</button>
          </div>
        )}
      </Section>

      <Section title="Players">
        <label className="row-check">
          <input type="checkbox" checked={p.showHumans} onChange={(e) => p.setShowHumans(e.target.checked)} />
          <span className="swatch" style={{ background: rgba(HUMAN_COLOR) }} /> Humans
        </label>
        <label className="row-check">
          <input type="checkbox" checked={p.showBots} onChange={(e) => p.setShowBots(e.target.checked)} />
          <span className="swatch" style={{ background: rgba(BOT_COLOR) }} /> Bots
        </label>
      </Section>

      <Section title="Layers">
        <label className="row-check">
          <input type="checkbox" checked={p.showPaths} onChange={(e) => p.setShowPaths(e.target.checked)} />
          Movement paths
        </label>
        <div className="sub-label">Trail style</div>
        <div className="seg sm">
          {(["persist", "comet"] as TrailMode[]).map((t) => (
            <button key={t} className={`seg-btn ${p.trailMode === t ? "active" : ""}`} onClick={() => p.setTrailMode(t)}>
              {t === "persist" ? "Persistent" : "Comet"}
            </button>
          ))}
        </div>
        <div className="sub-label">Events</div>
        {(Object.keys(EVENT_COLORS) as EventCategory[]).map((c) => (
          <label key={c} className="row-check">
            <input type="checkbox" checked={p.eventToggles[c]} onChange={() => toggleEvent(c)} />
            <span className="swatch" style={{ background: rgba(EVENT_COLORS[c]) }} /> {EVENT_LABEL[c]}
          </label>
        ))}
      </Section>

      <Section title="Heatmap">
        <div className="chips">
          {HEATS.map((h) => (
            <button key={h.id} className={`chip ${p.heatmap === h.id ? "active" : ""}`} onClick={() => p.setHeatmap(h.id)}>
              {h.label}
            </button>
          ))}
        </div>
        {p.heatmap !== "none" && (
          <>
            <label className="row-check small" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={p.heatmapOnly} onChange={(e) => p.setHeatmapOnly(e.target.checked)} />
              Heatmap only (hide paths &amp; markers)
            </label>
            <div className="hint">Density of {p.heatmap === "traffic" ? "all movement samples" : `${p.heatmap} events`} in view.</div>
          </>
        )}
        <label className="row-check" style={{ marginTop: 10 }}>
          <input type="checkbox" checked={p.hotspotsOpen} onChange={(e) => p.setHotspotsOpen(e.target.checked)} />
          Hotspot ranking panel
        </label>
        <label className="row-check">
          <input type="checkbox" checked={p.showSurvival} onChange={(e) => p.setShowSurvival(e.target.checked)} />
          Players-remaining curve
        </label>
        <label className="row-check">
          <input type="checkbox" checked={p.pinMode} onChange={(e) => p.setPinMode(e.target.checked)} />
          Add notes (click the map)
        </label>
        {p.pinCount > 0 && (
          <div className="hint">{p.pinCount} note{p.pinCount > 1 ? "s" : ""} · click one to delete · <button className="link-btn" onClick={p.onClearPins}>clear all</button></div>
        )}
      </Section>

      <div className="sidebar-footer">
        <div className="showing">
          Showing <b>{p.filteredCount}</b> journeys · <b>{p.eventCount.toLocaleString()}</b> events
        </div>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="ctl-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

