import type { ReactNode } from "react";
import { HUMAN_COLOR, BOT_COLOR, EVENT_COLORS, EVENT_GLYPH, EVENT_LABEL } from "./theme";
import type { EventCategory } from "./types";

const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

export default function Help({ onClose }: { onClose: () => void }) {
  return (
    <div className="help-backdrop" onClick={onClose}>
      <div className="help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="help-head">
          <span>What am I looking at?</span>
          <button className="hs-close" aria-label="Close help" onClick={onClose}>×</button>
        </div>
        <div className="help-body">
          <Item title="Player paths">
            Each line is one player's route through a single match.{" "}
            <b style={{ color: rgb(HUMAN_COLOR) }}>Blue = human</b>, <b style={{ color: rgb(BOT_COLOR) }}>pink = bot</b>.
          </Item>
          <Item title="Event markers">
            Where things happened. The glyph is the event type; the ring around it shows <i>who</i> it happened to
            (blue = human, pink = bot). Hover any marker for the full story.
            <div className="help-glyphs">
              {(Object.keys(EVENT_COLORS) as EventCategory[]).map((c) => (
                <span key={c}><span className="hg" style={{ color: rgb(EVENT_COLORS[c]) }}>{EVENT_GLYPH[c]}</span> {EVENT_LABEL[c]}</span>
              ))}
            </div>
          </Item>
          <Item title="Kills vs deaths — are they double-counted?">
            No. A <b>kill</b> is logged from the shooter's side (at <i>their</i> spot); a <b>death</b> from the victim's
            side (where they fell) — two different, useful locations. We always keep them as <b>separate</b> counts and
            never add them together. (In this data almost all combat is human-vs-bot, so kills and deaths are largely
            different events anyway, not two halves of one fight.)
          </Item>
          <Item title="Heatmaps">A colored cloud showing where something is dense — traffic, kills, deaths or loot. Brighter = more.</Item>
          <Item title="Stats (bottom-right)">A plain-language summary of the current view — the busiest, deadliest and top-loot spots, match length, survival and map coverage. Click a spot to jump to it. Tap its header to collapse it.</Item>
          <Item title="Hotspots panel">The ranked busiest cells for one metric, numbered on the map. The faint circle is the area each count covers. It updates live as a match plays.</Item>
          <Item title="Players-remaining curve">How many players are still in the match over time. The violet band marks when storm deaths happen.</Item>
          <Item title="Timeline">Press ▶ to watch a match unfold; drag to any moment. Speed is match-seconds per real second.</Item>
          <Item title="Top-bar stats">For the current view: players still in the match count <i>down</i>, while kills / deaths / loot count <i>up</i> as the match plays.</Item>
          <Item title="Filters & sharing">Narrow by map, date, match or player type. The whole view is saved in the URL — copy the address bar to share this exact picture.</Item>
        </div>
      </div>
    </div>
  );
}

function Item({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="help-item">
      <div className="help-title">{title}</div>
      <div className="help-text">{children}</div>
    </div>
  );
}
