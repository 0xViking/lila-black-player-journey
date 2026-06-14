# LILA BLACK — Player Journey Explorer

A web tool for LILA Games' Level Design team to **see** how players move through a map: their routes,
where they fight bots, where they loot, where the storm catches them, which corridors carry the game,
and which areas get ignored. It's styled as a dark, map-first **tactical HUD** — the kind of internal
tool a shooter studio runs (see [ARCHITECTURE.md](ARCHITECTURE.md#visual-identity)).

**▶ Live demo:** _<add deployed URL here>_

It loads 5 days of production telemetry from **LILA BLACK** (1,243 Parquet files, ~89 k events,
339 players, 796 matches across 3 maps) and renders it on the real minimaps.

## Features

- **Journeys on the real minimap** — world `(x,z)` correctly mapped to each map's minimap image.
- **Humans vs bots** — distinct colors (blue / pink), toggle either off.
- **Event markers** — kills, deaths, loot and storm deaths as distinct glyphs, each with an
  owner-colored ring (blue = human, pink = bot) and a precise hover tooltip.
- **Filter** by map, date (Feb 10–14), and individual match (with a *multiplayer-only* filter for the
  matches that actually have a full lobby).
- **Timeline playback** — scrub or play a match unfolding over time, with live position markers and a
  persistent-trail / comet mode. Speeds 10×–100× (match-seconds per real second).
- **Live stats** — humans/bots count *down* (players remaining) while kills/deaths/loot count *up* as a match plays.
- **Heatmaps** — traffic, kill, death and loot density overlays, with a clean *heatmap-only* mode.
- **Hotspot panel** — ranked top kill/death/loot/traffic cells; **click a row to drop a numbered marker** (with its catchment circle) on the map and zoom to it, click again to remove; **updates live during playback**.
- **Stats box** (bottom-right) — plain-language read of the *current* selection: busiest / deadliest / top-loot spots, **time-to-first loot / kill / death / storm with coordinates**, match length, survival %, and map coverage & balance; click any spot to jump+highlight it.
- **"What am I looking at?"** — a help overlay (auto-shown on first visit) explaining every color, marker and panel for non-experts — including why kills & deaths aren't double-counted.
- **Map notes** — drop labeled pins on the map (saved in the shareable link).
- **Players-remaining curve** — a survival chart for the selection, with the storm-death window shaded.
- **Shareable deep-links** — the map+match+filters+heatmap+time are encoded in the URL, so any view is one copyable link.
- **Hover** any event for details; pan/zoom the map; one-click *Reset view*.
- **Tactical HUD look** — reticle logo, corner targeting brackets and a mil-dot timeline. **Mobile-aware:**
  below 860 px the sidebar becomes a slide-over drawer and the legend / stats panels collapse so they never
  cover the map.

See **[WALKTHROUGH.md](WALKTHROUGH.md)** for a guided tour of every feature,
**[ARCHITECTURE.md](ARCHITECTURE.md)** for how it works, and **[INSIGHTS.md](INSIGHTS.md)** for three
level-design edits the data points to.

## Tech stack

| | |
|---|---|
| ETL | Python 3.10+, `pyarrow`, `pandas`, `numpy`, `pillow` |
| Frontend | React 18, TypeScript, Vite, deck.gl 9 (`OrthographicView`, Trips/Heatmap/Bitmap/Icon/Scatter layers) |
| Hosting | Static — Vercel / any CDN |

No backend, no database, no environment variables required.

## Project layout

```
lila-player-journey/
├── etl/
│   ├── build_data.py     # Parquet  ->  web/public/data/*.json  + downscaled minimaps
│   └── insights.py       # reproduces every number in INSIGHTS.md
├── web/                  # Vite + React + deck.gl app
│   ├── src/
│   └── public/
│       ├── data/         # generated JSON (committed so the app runs without the raw data)
│       └── minimaps/     # generated, web-sized minimaps
├── data/                 # raw player_data/ (NOT committed — see Setup)
├── ARCHITECTURE.md
└── INSIGHTS.md
```

## Setup

### Run the app (data is already generated and committed)

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

### Build for production

```bash
cd web
npm run build        # -> web/dist  (static; deploy this folder)
npm run preview      # serve the production build locally
```

### Regenerate the data from the raw Parquet (optional)

The processed JSON and minimaps are committed, so this is only needed if the raw data changes.

```bash
# place the unzipped dataset at  data/player_data/  (the folder with February_10..14/, minimaps/)
pip install pyarrow pandas pillow numpy
python etl/build_data.py     # writes web/public/data/ + web/public/minimaps/
python etl/insights.py       # prints the headline stats used in INSIGHTS.md
```

## Deploy

The app is a static SPA — any static host works. Root-level [`vercel.json`](vercel.json) is included, so
connecting this GitHub repo to Vercel builds the `web/` app with no extra config.

**Vercel (CLI)**
```bash
npm i -g vercel
vercel --prod            # run from the repo root; vercel.json handles the rest
```
