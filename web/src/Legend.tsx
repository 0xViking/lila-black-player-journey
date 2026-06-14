import { useState } from "react";
import { EVENT_COLORS, EVENT_GLYPH, EVENT_LABEL, HUMAN_COLOR, BOT_COLOR } from "./theme";
import type { EventCategory } from "./types";

const rgba = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

export default function Legend() {
  const [collapsed, setCollapsed] = useState(true); // closed by default; click the header to open

  const toggle = () => setCollapsed((c) => !c);
  return (
    <div className={`legend ${collapsed ? "collapsed" : ""}`}>
      <div className="legend-head" onClick={toggle} role="button" tabIndex={0}
        aria-expanded={!collapsed} aria-label={collapsed ? "Expand legend" : "Collapse legend"}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}>
        <span className="legend-head-l"><span className="led-mini" /> Legend</span>
        <span className="panel-toggle" aria-hidden="true">{collapsed ? "▸" : "▾"}</span>
      </div>
      <div className="legend-body">
        <div className="legend-row">
          <span className="line" style={{ background: rgba(HUMAN_COLOR) }} /> Human path
        </div>
        <div className="legend-row">
          <span className="line" style={{ background: rgba(BOT_COLOR) }} /> Bot path
        </div>
        <div className="legend-divider" />
        {(Object.keys(EVENT_COLORS) as EventCategory[]).map((c) => (
          <div className="legend-row" key={c}>
            <span className="glyph" style={{ color: rgba(EVENT_COLORS[c]) }}>{EVENT_GLYPH[c]}</span>
            {EVENT_LABEL[c]}
          </div>
        ))}
        <div className="legend-note">marker ring shows whose event<br />(blue = human, pink = bot)</div>
      </div>
    </div>
  );
}
