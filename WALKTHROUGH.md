# Walkthrough - every major feature, in order

A guided tour of the tool. Open the live demo (or `cd web && npm run dev`) and follow along; each step
names the control and what to look for.

## 0. Orientation
- **Left sidebar** = all controls (map, date, match, players, layers, heatmap).
- **Center** = the minimap with player journeys drawn on it. Pan with drag, zoom with scroll, **Reset view** (sidebar footer) to refit.
- **Top-right legend** = color/marker key. **Bottom timeline** = playback. **Top bar** = live stats that react to your selection.

## 1. Maps (C2 - coordinate mapping)
- Use the **Map** segmented control to switch **Ambrose Valley → Grand Rift → Lockdown**.
- Each loads its own minimap with world `(x,z)` mapped into the image. Notice paths hug the landmass and roads - coordinates are correct (verified: the README's worked example lands to the pixel, 0 / 89,104 points out of bounds).

## 2. Humans vs bots (C3)
- In **Players**, toggle **Humans** (blue) and **Bots** (pink) on/off. Paths, live heads, and event-marker rings all share this color coding.

## 3. Filtering by date and match (C5)
- **Date** chips (Feb 10-14) multi-select; "All" clears them.
- **Match** dropdown picks one match. Tick **Multiplayer only (≥7 players)** to jump to the ~50 real multi-player lobbies (marked ★) - most matches are single-journey, so these are the best ones to *watch*.
- With a match selected, the info line shows its players / loot / kills / deaths / duration. The Humans/Bots toggles still apply within a match.

## 4. Event markers (C4)
- In **Layers → Events**, toggle **Kill / Death / Storm / Loot**. Each is a distinct glyph (crosshair / X / burst / diamond) in a distinct color.
- **The ring around each marker shows *who* the event happened to** - blue ring = human, pink ring = bot. Hover any marker for a precise tooltip ("Human killed a bot", "Bot was killed", "Killed by the storm", …). Try match **`6edefa1c`** on Lockdown: its lone death is a *bot* death (pink ring), correctly not shown as a human kill.

## 5. Timeline playback (C6)
- Pick a ★ multiplayer match. The clock starts at **0:00** showing the full overview.
- Press **▶** to watch the match unfold - paths draw in, markers appear at their moment, and live position **heads** move along each route. **Scrub** to jump anywhere; pick a **speed** (10×-100× match-time).
- **Trail style: Persistent** (whole route accumulates) vs **Comet** (a moving tail showing flow).
- Watch the **top bar** tick: humans/bots **count down** (players remaining) while kills/deaths/loot **count up** - bots empty out before humans (they're shorter-lived).

## 6. Heatmaps (C7)
- **Heatmap**: Off / **Traffic** / **Kills** / **Deaths** / **Loot**. Traffic uses every movement sample; the others use the matching events (independent of the marker toggles).
- **Heatmap only** (on by default) hides paths/markers for a clean density read; uncheck to overlay. Traffic on Ambrose shows the corridor web + central combat hotspot.

## 7. Level-design analytics (bonus)
- **Stats box** (bottom-right, like the legend): a plain-language read of the *current* selection - busiest / deadliest / top-loot spots, **time-to-first loot / kill / death / storm with coordinates**, typical match length, survival %, and **how much of the map is used + which side it skews to**. Click any spot to zoom+highlight it.
- **Hotspot ranking panel**: ranked top-8 cells for Traffic / Kills / Deaths / Loot. **Click a row to drop a numbered orange marker** (with a circle showing the cell its count covers) and zoom to it; click again to remove. During playback it shows **● live** and ranks only what's happened so far.
- **Players-remaining curve**: a survival chart for the current selection - players count down as journeys end, with the **storm-death window shaded** and a cursor that tracks playback. The same storm band appears on the timeline scrubber.
- **Map notes**: tick *Add notes* and click the map to drop a labeled pin (e.g. "add cover here"). Pins are saved in the shareable link; click a pin to delete it.
- **"What am I looking at?"** (the **?** top-right): a help panel explaining every color, marker, heatmap and panel - built for a first-time, non-data-scientist user.

## 8. Share a view (deep-link)
- Everything above is encoded in the URL. Set up *exactly* the view you want - e.g. Lockdown, a specific match, the death heatmap, scrubbed to 4:52 - and copy the address bar. Whoever opens it lands on the identical view.

## 9. Hosting (C8)
- The same view is available at the deployed URL in the [README](README.md) - open it and everything above works with no setup.

---

For *why* it's built this way see [ARCHITECTURE.md](ARCHITECTURE.md); for what the data revealed see [INSIGHTS.md](INSIGHTS.md).
