# Architecture

A two-stage design: an **offline Python ETL** turns 1,243 raw Parquet files into a handful of
compact JSON files + web-sized minimaps, and a **static React/deck.gl single-page app** renders them
entirely client-side. There is no backend or database - the dataset is small enough (~89 k rows) to
live in the browser, which makes hosting free, the link trivially shareable, and the whole pipeline
reproducible with one command.

## What it's built with, and why

| Layer | Choice | Why |
|-------|--------|-----|
| ETL | **Python + pyarrow + pandas + Pillow** | pyarrow reads the extension-less Parquet natively and decodes the `bytes` event column; Pillow downsizes the huge minimaps. The per-file hot loop indexes pre-extracted numpy arrays (no per-row pandas `.iloc`), so it stays fast. |
| Rendering | **deck.gl (`OrthographicView`)** | GPU rendering handles 89 k points, full journey paths, animated playback (`TripsLayer`) and heatmaps (`HeatmapLayer`) at 60 fps without breaking a sweat. An orthographic view is the natural fit for "annotate a flat image in pixel space." |
| App | **React + TypeScript + Vite** | Fast dev loop, typed data contracts end-to-end, trivial static build. |
| Hosting | **Static (Vercel/any CDN)** | `vite build` → a `dist/` folder of static assets. No server to run or pay for. |

## How data flows from Parquet to the screen

```
1,243 × *.nakama-0 (Parquet)
        │   etl/build_data.py
        │   • decode event bytes → string
        │   • classify human (UUID id) vs bot (numeric id)
        │   • date  ← folder name (NOT ts)
        │   • time  ← per-match relative ts, treated as seconds
        │   • world (x,z) → UV (0..1) via per-map scale/origin
        ▼
web/public/data/
   manifest.json        ← maps config, 796 match summaries, dates, global stats
   map_<MapId>.json     ← one file per map: every journey (path + discrete events)
web/public/minimaps/    ← minimaps downscaled to ≤2048 px
        │   fetch() on demand (only the selected map's file loads)
        ▼
prepare.ts   UV → render-space XY, precomputed once per map
        ▼
deck.gl layers
   BitmapLayer (minimap)  ·  HeatmapLayer (traffic/kills/deaths/loot)
   TripsLayer (paths, time-animated)  ·  ScatterplotLayer (live position heads)
   IconLayer (kill/death/loot/storm glyph markers, canvas atlas) + owner-color rings
        ▲
   React state: map · date · match · human/bot · event toggles · heatmap mode · playback clock
```

All filtering, playback and heatmap aggregation happen **in memory on the client**, so interaction is
instant and the only network cost is the one map file you're looking at (≤1.6 MB, gzips to ~0.4 MB).

## The tricky part: world → minimap coordinate mapping

The README gives, per map, a `scale` and an origin `(originX, originZ)`. For a world point `(x, z)`
(the `y` column is elevation and is ignored for the 2-D map):

```
u = (x - originX) / scale            # → 0..1 across the map
v = (z - originZ) / scale
renderX = u * 1024
renderY = (1 - v) * 1024             # Y flipped: image origin is top-left
```

Three decisions made this robust:

1. **Normalize to UV, then to a fixed 1024² render space - don't trust the stated image size.** The
   README claims the minimaps are 1024×1024, but the actual files are **4320, 2160 and 9000 px**.
   Because everything is mapped through UV (0-1) and drawn into a constant 1024² logical space, the
   real (and downscaled) image dimensions never enter the math - only the aspect ratio does. I verified
   the mapping by reproducing the README's worked example (`x=-301.45, z=-355.55 → px(78, 890)`) and by
   confirming **0 of 89,104 points fall outside [0,1]** for any map.
2. **The Y flip** (`1 - v`) accounts for image origin being top-left while world `z` increases "up."
   In deck.gl this is realized with `OrthographicView({flipY: true})` and a `BitmapLayer` bounded at
   `[0, 1024, 1024, 0]`, so the minimap and the data share one coordinate system.
3. **Time is reconstructed per match, in seconds.** `ts` is stored as a millisecond timestamp but the
   values are seconds-scale; the app subtracts each match's start and treats the remainder as seconds
   of match time, which yields the realistic ~5-minute median journey used by the timeline.

## Assumptions made where the data was ambiguous

- **Human vs bot = UUID vs numeric id**, exactly as the README specifies - even though 17 numeric-id
  files emit human-style `Position` samples (ids `1429`/`1379`/`1402`, with `1429` mixed). I kept the
  prescribed rule and documented the discrepancy rather than silently "correcting" it (see INSIGHTS.md,
  note *d*). These three render as bots (pink), including their event rings.
- **`ts` is seconds, not milliseconds** (note *a*). Playback speed is therefore expressed as
  "match-seconds per real second" (10×-100×), since a literal 1× would take 5+ real minutes.
- **Date = folder name** (note *b*); `ts` carries no wall-clock date.
- **`KilledByStorm`/`BotKilled`/`Killed` mark a death; `Kill`/`BotKill` mark a kill dealt.** The four
  on-screen marker categories are kills, deaths, loot, storm. `BotKill`/`BotKilled` are treated as
  human-vs-bot combat regardless of which file they sit in.
- **A match is rarely a full lobby:** 743/796 matches have a single player file, so "watch a match
  unfold" is most meaningful on the ~50 multi-file matches (surfaced via the *Multiplayer only* filter
  and a ★ in the picker). Single-journey matches still play back fine.
- **GrandRift's minimap is 2160×2158** (≈ square); the 2 px difference is treated as square.

## Visual identity

The UI is themed as a **tactical HUD** so it reads unmistakably as an internal tool at a shooter studio
(the brief is a level-design tool for a tactical extraction shooter). It is a near-pure-CSS re-skin driven
by CSS variables plus one inline SVG and one web font:

- **Two-accent discipline.** A warm **HUD orange `#FF7A1A`** owns the chrome only - corner targeting
  brackets, section ticks, the mil-dot timeline graticule, the reticle logo. **Cyan `#38BDF8` stays the
  interactive/data accent** (active controls, scrub fill, playhead, human paths). Orange was chosen over
  amber specifically because it sits farther from the locked loot-yellow `#facc15`, so no chrome color is
  ever confused with a map data color.
- **Type split.** *Saira Semi Condensed* (one Google font) for uppercase labels/headers/brand; a system
  **monospace with `tabular-nums`** for every number, so coordinates and KPIs don't jitter during playback.
- **Motifs:** corner brackets on every floating panel, an open-center weapon-sight **reticle logo** (with
  an extraction chevron), faint chrome-only scanlines, and an orange left-spine on list rows. All
  decorative motion respects `prefers-reduced-motion`.

The direction came from a small generate-and-judge design pass (four divergent concepts - ops-HUD,
optics/scope, classified-dossier, sci-fi - scored on "reads as a shooter-studio tool", buildability,
data-color safety and legibility) synthesised into the spec above.

## Responsive

Desktop-first, but **mobile-aware**: below 860 px the sidebar becomes a slide-over drawer (hamburger +
backdrop), the always-on overlays (legend, stats) **collapse to their headers by default** so they never
cover the map, the bottom panels are de-conflicted, the timeline stays a single compact row, and the
dataset readout drops out before it would truncate. The cyan interaction accent and all data colors are
unchanged across the breakpoint.

## Known limitations

- **No server-side aggregation.** Everything is client-side; a much larger dataset (≫100 k rows) would
  eventually want DuckDB-WASM or a small API. At this scale the static approach wins (see tradeoffs).

## Major tradeoffs

| Decision | Considered | Chosen - and why |
|----------|-----------|------------------|
| Where computation lives | Backend API / DuckDB-WASM / **static JSON** | **Static JSON.** 89 k rows fit in memory; a backend adds cost and ops for zero benefit at this scale. |
| Data granularity | One giant file / per-match files / **per-map files** | **Per-map.** Lazy-loads only the viewed map; keeps all of a map's matches in memory for instant cross-match heatmaps and filtering. |
| Rendering | Leaflet image overlay / SVG / Canvas2D / **deck.gl** | **deck.gl.** Only option that does 89 k points + animated trips + GPU heatmaps smoothly, with pan/zoom for free. Cost: a larger JS bundle (263 KB gzip). |
| Bot/human rule | Behavioral (event channel) / **id-based** | **Id-based** per the README spec; behavioral discrepancy documented, not hidden. |
| Playback reveal | Comet trail / **persistent draw** (toggle for both) | **Persistent** by default so designers see the *whole* route accumulate; a Comet mode shows flow. |
| Minimap weight | Full-res (10 MB) / **≤2048 px** | Downscaled. UV mapping makes resolution irrelevant to correctness; saves ~20 MB of load. |
