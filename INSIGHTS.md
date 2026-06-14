# Three map edits the telemetry points to

Written for a level designer: each section is a finding, the **edit** it implies, and how to **see it
in the tool**. Numbers cover the full dataset (1,243 files / 89,104 rows) and are reproduced by
[`etl/insights.py`](etl/insights.py).

**Context - what the maps should be tuned for.** This is effectively a **PvE game**: 779 / 796 matches
are 1 human + bots, and human-vs-human kills are ≈ 0 (just 3 `Kill` + 3 `Killed`, all self-logged from
one perspective) against 3,115 human-vs-bot combat events. The bots are also easy to read - they move
~27 % faster, die ~40 % sooner, loot in 3 % of journeys vs 92.7 % for humans, and they avoid the eastern
POIs humans pour into. So tune the maps for **PvE pacing and bot encounters, not human duels.**
*(Matchmaking density and bot-AI behaviour are the fixes for the PvE/bot findings - those aren't a level
designer's lever, so they're context here, not edits below.)*

---

## 1. Cut or activate the dead space - a quarter to a half of every map is never entered

Players never set foot in a large share of the playable area:

| Map | Empty cells (zero visits) | |
|---|---|---|
| Ambrose Valley | **23.5 %** | |
| Grand Rift | **26.2 %** | |
| Lockdown | **30.3 %** | ~50 % counting near-cold cells → **fix first** |

**Edit:** for each cold region, either **activate it** (drop a POI, loot or cover to pull traffic in)
or **retire it** (pull the playable boundary inward, or start the storm earlier so dead corners stop
padding match length). Lockdown is the priority - roughly half of it returns nothing for the
level-design budget spent on it.
**See it:** pick the map, turn the **Traffic** heatmap on and paths off - the dark regions inside the
boundary are the dead space; the **Hotspots** panel lists the live cells with world coordinates.

---

## 2. Put your cover and chokepoints on the ~15 % backbone - and design the centre for the endgame

The game funnels through a thin spine: **50 % of all movement** is in just the top **17-20 %** of
visited cells (Ambrose 17.6 %, Grand Rift 19.6 %, Lockdown 17.9 %). And loot, traffic and combat **stack
on the same cells** (per-cell loot↔traffic correlation r ≈ 0.80-0.86):

- On Ambrose the cell at world **`(10, -6)`** is **#1 for both kills *and* deaths** - a natural arena.
- All 39 **storm deaths cluster near map centre**, not the edges - the final circle pulls *inward*, so
  the deciding fights happen in the core.

**Edit:** spend your best **chokepoint geometry, cover and sightlines on that ~15 % backbone**, and make
the **central core endgame-friendly** (cover + multiple approaches for the converging final circle).
Decide deliberately whether you want one super-contested cell like `(10, -6)` or want to split
contention by spreading loot off it.
**See it:** the **Traffic / Kills / Deaths** heatmaps, and the **Hotspots** panel (click a row to drop a
coordinate-tagged marker on the cell).

---

## 3. Players funnel east and ignore the west - move the attractors to rebalance traffic

Movement is lopsided toward the eastern POIs. On Ambrose, world **`(178, -290)`** takes **195 human
visits and 0 bot visits** - a pure human magnet - while the west and centre stay thin. The loot magnets
anchoring that pull: Ambrose **`(102, -270)`**, Grand Rift **`(-72, 15)`**, Lockdown **`(125, -25)`**.

**Edit:** if you want players spread out (more even contention, less dead space from Insight 1),
**relocate some loot/POIs off the eastern magnets toward the underused west** - moving attractors is the
most direct lever on where players go. If instead you want a marquee fight, lean the other way and
concentrate the draw.
**See it:** the **Loot** heatmap with Humans vs Bots toggled, and the **Stats** box, which reports the
east/west traffic skew for the current selection.

---

## Data-quality notes - why the numbers above can be trusted

Each of these would quietly corrupt a naïve analysis; the tool and ETL handle them explicitly.

| | Finding | Why it matters |
|---|---------|----------------|
| a | **`ts` is seconds-scale, not the "ms" it's labelled.** Read literally a whole match spans 0.4 s. | Treated as per-match-relative seconds → realistic 5.1-min median journey; otherwise durations/playback are 1000× off. |
| b | **Date comes from the folder, not `ts`.** Every match shares one ~400 s `ts` window. | Filtering "by date" off `ts` would collapse all 5 days into one. |
| c | **`BotKilled` is owner-relative** - 297 of 700 rows are *bots'* own deaths. | Summing all 700 as human deaths overstates by 74 %; only the 403 human-file rows are human deaths. |
| d | **17 numeric-id files emit human-style `Position`** (ids `1429`/`1379`/`1402`; `1429` is mixed). | The README's id-based human/bot rule is imperfect; the event channel is cleaner. Tool follows the README rule, discrepancy documented. |
| e | **Minimaps aren't 1024² - they're 4320 / 2160 / 9000 px.** | Mapping is done in normalized UV, so display size never affects correctness; images are downscaled only for load speed. |
| f | **Engagement is collapsing in-window:** files/day **437 → 79 (-82 %)**, unique humans/day **98 → 12**, only **16 %** return on a 2nd day. | If this is live data it's a day-2 retention alarm; if a test window, read the trend with that caveat. |
