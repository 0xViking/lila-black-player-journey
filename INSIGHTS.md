# Three things the data taught me about LILA BLACK

> All numbers below were computed over the full dataset (1,243 files / 89,104 rows) and
> independently re-verified. The script that reproduces every figure is
> [`etl/insights.py`](etl/insights.py); every spatial claim is also visible directly in the
> tool (filter to the map, switch on the relevant heatmap).

---

## 1. This "extraction shooter" has almost no one to extract *from* — it's a PvE game in a battle-royale costume

**What caught my eye.** I switched the event filter to *Kills* and *Deaths* and the map went
nearly blank for human-vs-human combat, while bot-combat markers were everywhere. So I counted.

**The evidence.**
- Human-vs-human combat across 89,104 rows: **3 `Kill` + 3 `Killed`**. Human-vs-bot combat:
  **2,415 `BotKill` + 700 `BotKilled`**. That's a **519 : 1** PvE-to-PvP ratio.
- Those 6 "PvP" rows aren't even real fights: in each of 3 files a `Kill` and a `Killed` share the
  *same* user, match, `(x,z)` and timestamp (e.g. user `00f02e70…` both at t=639 s, world
  `(15.4, 103.9)`). They're one death double-logged from a single perspective — **genuine
  human-vs-human kills ≈ 0**.
- It's structural, not a fluke: **779 of 796 matches contain exactly one human**; every one of the
  50 "big" lobbies (7–16 player files) is **1 human + the rest bots** (largest = 1 human + 15 bots).
  Humans solo-queue into bot lobbies essentially 100% of the time.
- And the PvE that *does* happen is a turkey-shoot: human-vs-bot K/D is **5.5 : 1**
  (GrandRift 7.5, Ambrose 5.6, Lockdown 4.7).

**Actionable.**
- *Action items:* decide the identity — either **raise human lobby density** so players actually
  meet (the matchmaker currently never co-locates two humans), or **commit to PvE** and make bot
  variety/difficulty the core loop. Buff bot K/D away from 5.5:1 if the PvE is meant to feel
  threatening. Separately, **file a telemetry bug**: `Kill`/`Killed` only ever appear as same-file
  self-pairs, so the killer's perspective is never being written.
- *Metrics affected:* PvP encounter rate, time-to-first-human-contact, lobby human-density,
  bot K/D, retention of any PvP-seeking cohort.

**Why a level designer should care.** Every instinct an extraction-shooter level designer has —
sightlines onto *other squads*, third-party ambush lanes, "fear of the next player" — is being
spent on a threat that isn't in the data. The map should be tuned for PvE pacing and bot encounters,
not human duels, until matchmaking changes.

---

## 2. A third to a half of every map is dead space, and the whole game funnels through ~15% of it

**What caught my eye.** The brief explicitly asks *"which areas get ignored."* With the **Traffic**
heatmap on and paths hidden, each map lights up as a thin web of bright corridors surrounded by
large dark regions the playable boundary clearly includes but players never enter.

**The evidence** (UV grid over each map's playable bounding box):
- **Empty cells (zero visits):** Ambrose **23.5%**, GrandRift **26.2%**, Lockdown **30.3%**
  (20×20 grid); at 32×32 this rises to **39%** on Lockdown. Counting near-zero "cold" cells,
  **~50% of Lockdown is effectively unused.**
- **Traffic is corridor-concentrated:** **50% of all movement** falls in just the top
  **17.6% / 19.6% / 17.9%** of visited cells (Ambrose / GrandRift / Lockdown, 20×20 grid).
- **Loot, traffic and combat collapse onto the same cells.** Per-cell loot↔traffic correlation is
  **r = 0.86 / 0.80 / 0.85**. On Ambrose the single cell at UV `(0.42, 0.52)` / world `(10, −6)`
  is **#1 for both kills *and* deaths**. Top loot magnets: Ambrose world `(102, −270)`,
  GrandRift `(−72, 15)`, Lockdown `(125, −25)`.
- **The storm doesn't pull players outward.** All 39 storm deaths cluster *near map center*
  (outer-15% ring holds only 10.3% of them vs a 9.0% baseline) — it reads as a converging final
  circle, not the "one-directional" sweep the README describes.

**Actionable.**
- *Action items:* map the empty cells back to world coords and **either activate them** (add loot
  / a POI / cover to pull traffic) **or cut them** (shrink the playable boundary, or start the storm
  earlier so dead corners stop padding match length). Lockdown is the priority (half its area is
  cold). The ~15% high-traffic backbone is where chokepoint cover and mid-tier loot pay off most.
- *Metrics affected:* map-area utilization, average rotation distance, loot contention at hotspots,
  match length, storm-death distribution.

**Why a level designer should care.** Unused playable area is spent level-design budget that returns
nothing, and it dilutes encounters by spreading players thin. This gives a **concrete, coordinate-level
list** of which tiles to activate vs retire — the highest-leverage edit on each map.

---

## 3. Bots are trivially identifiable, and they roam different ground than humans

**What caught my eye.** Coloring paths by human (blue) vs bot (pink) and scrubbing the timeline, bots
visibly dart around faster, die sooner, and never stop to loot — and they hug the center/west while
humans pour into the eastern POIs.

**The evidence.**
- **Bots move ~27% faster** (median 2.79 vs 2.20 world-units/s) and their whole speed distribution
  sits above humans'.
- **Bots live ~40% shorter** (median journey 216 s vs 367 s) and cover less ground (599 vs 803 units,
  17 vs 23 distinct cells visited).
- **Bots don't loot:** `Loot` appears in **92.7% of human journeys** but only **3.0% of bot journeys**
  — a near-perfect behavioral discriminator on its own.
- **Different footprints:** humans and bots occupy nearly the same cells (Jaccard 0.90) but weight
  them very differently (spatial cosine only 0.60). Humans dominate east POIs — e.g. world `(178, −290)`
  has **195 human visits and 0 bot visits** — while bots cluster the center/west.

**Actionable.**
- *Action items:* close the believability tells — **cap bot speed** nearer the human median (~2.3 u/s),
  **extend bot lifespan** so they don't despawn ~150 s early, and give bots a **light loot-pickup loop**.
  **Relocate bot patrols toward the human POIs** (e.g. east Ambrose) if you want bots to actually
  contest loot instead of reading as background scenery.
- *Metrics affected:* bot believability, encounter density in contested zones, average time-alive
  parity, perceived difficulty.

**Why a level designer should care.** If a "full" lobby is mostly bots (see Insight 1) and those bots
are instantly recognizable and avoid the places humans go, the map *feels* empty exactly where it
should feel alive. Fixing bot routing/pacing is a level-design lever, not just an AI one.

---

## Bonus — data-quality findings (attention-to-detail notes)

These don't change the design story but every one of them would silently corrupt a naïve analysis, so
the tool and ETL handle them explicitly:

| # | Finding | Why it matters |
|---|---------|----------------|
| a | **`ts` is mislabeled "milliseconds."** Read literally, a whole journey spans 0.4 s. The values are **seconds-scale** — median journey is **5.1 min**, sampled every ~5 s. | All durations/playback would be 1000× wrong if taken at face value. The tool treats per-match relative `ts` as seconds. |
| b | **Date must come from the folder, not `ts`.** Every match shares one ~400 s `ts` epoch window. | Filtering "by date" off `ts` would collapse all 5 days into one. |
| c | **`BotKilled` is owner-relative.** 297 of the 700 rows live in *bot* files (each bot's own death, exactly 1/file). Summing all 700 as human deaths **overstates human deaths by 74%**. | Any survival/K-D dashboard that sums globally is wrong; only the 403 human-file rows are human deaths. |
| d | **17 numeric-id files emit human-style `Position` samples** (from ids `1429`/`1379`/`1402`; `1429` is *mixed* — it logs both `Position` and `BotPosition`). So the README's id-based human/bot rule is imperfect; the **event channel** (`Position` vs `BotPosition`) is the cleaner classifier. | The tool follows the README's id rule (as specified) but the discrepancy is documented. |
| e | **Minimaps aren't 1024×1024** as the README states — they're 4320 / 2160 / 9000 px. | Mapping is done in normalized UV (0–1), so display size is irrelevant to correctness; images are downscaled only for load speed. |
| f | **Engagement is collapsing in-window:** files fell **437 → 79 (−82%)** over the 5 days and daily unique humans fell **98 → 12**; only **16%** of humans return on a 2nd day (though 57% play 2+ matches in a session). | If this were live data it's an existential day-2 retention signal; if it's a test window, the trend should be read with that caveat. |
