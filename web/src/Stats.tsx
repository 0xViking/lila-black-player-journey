import { useState } from "react";
import { EVENT_COLORS } from "./theme";

interface First {
  t: number; world: [number, number] | null; center: [number, number] | null;
  lastT: number; lastWorld: [number, number] | null; lastCenter: [number, number] | null; players: number;
}
export interface StatsData {
  firstLoot: First | null; firstKill: First | null; firstDeath: First | null; firstStorm: First | null;
  medianSec: number; survivalPct: number; aliveNow: number; alivePct: number;
  humans: number; bots: number; uniqueHumans: number; uniqueBots: number;
  coveragePct: number; skew: string; journeys: number;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

interface Props { data: StatsData; live: boolean; onPick: (xy: [number, number], label: string) => void; }

export default function Stats({ data, live, onPick }: Props) {
  const [collapsed, setCollapsed] = useState(true); // closed by default; click the header to open
  const toggle = () => setCollapsed((c) => !c);
  const Mile = ({ label, color, f }: { label: string; color: number[]; f: First | null }) =>
    f ? (
      <div className="st-row st-pace">
        <span className="st-dot" style={{ background: rgb(color) }} /><span className="st-l">{label}</span>
        <span className="st-range">
          <button className="st-t" onClick={() => f.center && onPick(f.center, `First ${label.toLowerCase()}`)}
            title={f.world ? `first player @ (${f.world[0]}, ${f.world[1]})` : ""}>{mmss(f.t)}</button>
          {f.players > 1 && (
            <>→<button className="st-t" onClick={() => f.lastCenter && onPick(f.lastCenter, `Last ${label.toLowerCase()}`)}
              title={f.lastWorld ? `last player @ (${f.lastWorld[0]}, ${f.lastWorld[1]})` : ""}>{mmss(f.lastT)}</button></>
          )}
        </span>
      </div>
    ) : (
      <div className="st-row muted"><span className="st-dot" style={{ background: rgb(color) }} /><span className="st-l">{label}</span><span className="st-v">{live ? "not yet" : "-"}</span></div>
    );
  return (
    <div className={`stats-box ${collapsed ? "collapsed" : ""}`}>
      <div className="st-head" onClick={toggle} role="button" tabIndex={0} aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand stats" : "Collapse stats"}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}>
        <span className="st-head-l">Stats <span className="st-sub">· {live ? "so far" : "current view"}</span></span>
        <span className="panel-toggle" aria-hidden="true">{collapsed ? "▸" : "▾"}</span>
      </div>
      <div className="st-body">
        <div className="st-sec">Pacing <span className="st-hint">first → last player · click a time</span></div>
        <Mile label="Loot" color={EVENT_COLORS.loot} f={data.firstLoot} />
        <Mile label="Kill" color={EVENT_COLORS.kill} f={data.firstKill} />
        <Mile label="Death" color={EVENT_COLORS.death} f={data.firstDeath} />
        <Mile label="Storm" color={EVENT_COLORS.storm} f={data.firstStorm} />
        <div className="st-sec">Match</div>
        {live ? (
          <div className="st-fact"><b>{data.alivePct}%</b> still in the match · <b>{data.aliveNow}</b> of {data.journeys} alive</div>
        ) : (
          <div className="st-fact"><b>{mmss(data.medianSec)}</b> typical match length · <b>{data.survivalPct}%</b> survive</div>
        )}
        <div className="st-fact"><b>{data.coveragePct}%</b> of map traversed · skews <b>{data.skew}</b></div>
        <div className="st-fact muted">
          <b>{data.journeys.toLocaleString()}</b> journeys · {data.humans.toLocaleString()} human, {data.bots.toLocaleString()} bot
        </div>
        <div className="st-fact muted" title="Distinct players in this selection - one player can appear in several matches, so this is ≤ the journey count.">
          <b>{(data.uniqueHumans + data.uniqueBots).toLocaleString()}</b> unique players · {data.uniqueHumans.toLocaleString()} human, {data.uniqueBots.toLocaleString()} bot
        </div>
      </div>
    </div>
  );
}
