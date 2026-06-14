#!/usr/bin/env python3
"""
ETL for the LILA BLACK Player Journey Visualization tool.

Reads the raw Parquet telemetry (1,243 `.nakama-0` files), normalizes it, maps
world coordinates onto minimap UV space, and emits compact JSON the web app can
load directly. Also downscales the (very large) minimap images for fast web load.

Run:  python etl/build_data.py
Outputs into:  web/public/data/*.json  and  web/public/minimaps/*

Key data decisions (documented in ARCHITECTURE.md):
- HUMAN if user_id is a UUID, BOT if user_id is purely numeric.
- DATE comes from the FOLDER name, never from `ts` (all matches share one epoch window).
- `ts` is stored as ms but the values are seconds-scale; we keep per-match RELATIVE
  time and treat it as SECONDS of match time (median journey ~5 min).
- World (x,z) -> UV: u=(x-originX)/scale, v=(z-originZ)/scale.  Render pixel:
  px=u*W, py=(1-v)*H  (Y flipped, image origin top-left).
- The README claims minimaps are 1024x1024 but the real files are 4320/2160/9000 px.
  Because we map to UV (0..1), the display size is independent of correctness; we
  downscale images to <=2048px purely for load speed.
"""
import os, re, glob, json, collections
import pyarrow.parquet as pq
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "player_data")
OUT_DATA = os.path.join(ROOT, "web", "public", "data")
OUT_MAPS = os.path.join(ROOT, "web", "public", "minimaps")
os.makedirs(OUT_DATA, exist_ok=True)
os.makedirs(OUT_MAPS, exist_ok=True)

# Per-map coordinate config from the README.
MAP_CFG = {
    "AmbroseValley": {"scale": 900, "originX": -370, "originZ": -473, "src": "AmbroseValley_Minimap.png", "out": "AmbroseValley.png"},
    "GrandRift":     {"scale": 581, "originX": -290, "originZ": -290, "src": "GrandRift_Minimap.png",     "out": "GrandRift.png"},
    "Lockdown":      {"scale": 1000,"originX": -500, "originZ": -500, "src": "Lockdown_Minimap.jpg",      "out": "Lockdown.jpg"},
}

MOVE_EVENTS = {"Position", "BotPosition"}
COMBAT_KILL = {"Kill", "BotKill"}          # a human dealt a kill
NUMERIC = re.compile(r"^\d+$")


def is_bot(uid: str) -> bool:
    return bool(NUMERIC.match(str(uid)))


def to_uv(x, z, cfg):
    u = (x - cfg["originX"]) / cfg["scale"]
    v = (z - cfg["originZ"]) / cfg["scale"]
    return u, v


def downscale_minimaps(max_dim=2048):
    print("Downscaling minimaps ...")
    out_dims = {}
    for mp, cfg in MAP_CFG.items():
        src = os.path.join(RAW, "minimaps", cfg["src"])
        im = Image.open(src)
        w, h = im.size
        scale = min(1.0, max_dim / max(w, h))
        nw, nh = int(round(w * scale)), int(round(h * scale))
        im = im.resize((nw, nh), Image.LANCZOS)
        dst = os.path.join(OUT_MAPS, cfg["out"])
        if cfg["out"].lower().endswith(".jpg"):
            im.convert("RGB").save(dst, "JPEG", quality=85, optimize=True)
        else:
            im.save(dst, "PNG", optimize=True)
        out_dims[mp] = {"origW": w, "origH": h, "w": nw, "h": nh}
        print(f"  {mp}: {w}x{h} -> {nw}x{nh}  ({os.path.getsize(dst)//1024} KB)")
    return out_dims


def main():
    files = sorted(glob.glob(os.path.join(RAW, "February_*", "*.nakama-0")))
    print(f"Reading {len(files)} parquet files ...")

    # per-map list of journeys
    journeys = collections.defaultdict(list)
    # per-match aggregation
    match_agg = {}
    # global stats
    ev_total = collections.Counter()
    humans, bots = set(), set()
    rows_per_map = collections.Counter()
    world_bounds = {mp: [1e18, -1e18, 1e18, -1e18] for mp in MAP_CFG}  # xmin xmax zmin zmax
    total_rows = 0
    oob = collections.Counter()  # points that map outside [0,1] UV (data-sanity check)
    skipped = 0

    for f in files:
        date = os.path.basename(os.path.dirname(f))
        # One bad file shouldn't abort a 1,243-file run: skip it and keep going.
        try:
            df = pq.read_table(f).to_pandas()
            if len(df) == 0:
                continue
            mp = str(df.map_id.iloc[0])
            if mp not in MAP_CFG:
                continue
            uid = str(df.user_id.iloc[0])
            mid = str(df.match_id.iloc[0])
            # Pull columns into numpy arrays ONCE; the hot loop indexes these instead of
            # using per-row pandas .iloc (the slow path). 'event' is stored as bytes and is
            # decoded in a single pass. ts: stored ms-scale, kept per-match-relative (seconds).
            ev = [e.decode() if isinstance(e, (bytes, bytearray)) else e for e in df["event"].to_numpy()]
            xs = df["x"].to_numpy(dtype="float64")
            zs = df["z"].to_numpy(dtype="float64")
            ts = df["ts"].astype("int64").to_numpy() // 10**6
        except Exception as ex:  # noqa: BLE001 - log and continue, don't crash the build
            print(f"  ! skipping {os.path.basename(f)}: {type(ex).__name__}: {ex}")
            skipped += 1
            continue

        cfg = MAP_CFG[mp]
        bot = is_bot(uid)
        (bots if bot else humans).add(uid)
        n = len(ev)
        rows_per_map[mp] += n
        total_rows += n

        t0 = int(ts.min())
        rel = (ts - t0).astype(int)  # seconds of match time (per the convention above)

        # world bounds for this map (vectorized min/max over the whole file)
        b = world_bounds[mp]
        b[0] = min(b[0], float(xs.min())); b[1] = max(b[1], float(xs.max()))
        b[2] = min(b[2], float(zs.min())); b[3] = max(b[3], float(zs.max()))

        path = []   # [u, v, t] movement samples, ordered by time
        events = []  # discrete non-movement events
        order = np.argsort(rel, kind="stable")
        ev_counts = collections.Counter()
        for i in order:
            e = ev[i]
            x = float(xs[i]); z = float(zs[i])
            u, v = to_uv(x, z, cfg)
            t = int(rel[i])
            ev_counts[e] += 1
            ev_total[e] += 1
            if not (0.0 <= u <= 1.0 and 0.0 <= v <= 1.0):
                oob[mp] += 1
            if e in MOVE_EVENTS:
                path.append([round(u, 4), round(v, 4), t])
            else:
                events.append({"e": e, "u": round(u, 4), "v": round(v, 4), "t": t})

        dur = int(rel.max()) if len(rel) else 0
        journeys[mp].append({
            "id": f"{uid}_{mid}",
            "match": mid,
            "user": uid,
            "isBot": bot,
            "date": date,
            "dur": dur,
            "path": path,
            "events": events,
        })

        # match-level aggregation
        ma = match_agg.setdefault(mid, {
            "match_id": mid, "map": mp, "date": date,
            "humans": set(), "bots": set(),
            "kills": 0, "deaths": 0, "loot": 0, "storm": 0,
            "rows": 0, "dur": 0,
        })
        (ma["bots"] if bot else ma["humans"]).add(uid)
        ma["rows"] += len(df)
        ma["dur"] = max(ma["dur"], dur)
        ma["kills"] += sum(ev_counts[e] for e in COMBAT_KILL)
        ma["deaths"] += sum(ev_counts[e] for e in ("Killed", "BotKilled"))
        ma["storm"] += ev_counts.get("KilledByStorm", 0)
        ma["loot"] += ev_counts.get("Loot", 0)

    # finalize per-map journey files
    print("Writing per-map data files ...")
    map_journey_counts = {}
    for mp, js in journeys.items():
        # sort journeys: multiplayer/human first for nicer default
        js.sort(key=lambda j: (j["date"], j["match"], j["isBot"]))
        out = {"map": mp, "config": {k: MAP_CFG[mp][k] for k in ("scale", "originX", "originZ")}, "journeys": js}
        path = os.path.join(OUT_DATA, f"map_{mp}.json")
        with open(path, "w") as fh:
            json.dump(out, fh, separators=(",", ":"))
        map_journey_counts[mp] = len(js)
        print(f"  map_{mp}.json: {len(js)} journeys  ({os.path.getsize(path)//1024} KB)")

    # finalize matches
    matches = []
    for mid, ma in match_agg.items():
        matches.append({
            "match_id": mid, "map": ma["map"], "date": ma["date"],
            "humans": len(ma["humans"]), "bots": len(ma["bots"]),
            "players": len(ma["humans"]) + len(ma["bots"]),
            "kills": ma["kills"], "deaths": ma["deaths"], "loot": ma["loot"], "storm": ma["storm"],
            "rows": ma["rows"], "dur": ma["dur"],
        })
    matches.sort(key=lambda m: (m["date"], -m["players"], m["match_id"]))

    out_dims = downscale_minimaps()

    maps_meta = {}
    for mp, cfg in MAP_CFG.items():
        b = world_bounds[mp]
        maps_meta[mp] = {
            "scale": cfg["scale"], "originX": cfg["originX"], "originZ": cfg["originZ"],
            "image": f"minimaps/{cfg['out']}",
            "imageW": out_dims[mp]["w"], "imageH": out_dims[mp]["h"],
            "worldBounds": {"xmin": round(b[0], 1), "xmax": round(b[1], 1), "zmin": round(b[2], 1), "zmax": round(b[3], 1)},
            "rows": rows_per_map[mp],
            "matches": sum(1 for m in matches if m["map"] == mp),
            "journeys": map_journey_counts.get(mp, 0),
        }

    dates = sorted({m["date"] for m in matches})
    manifest = {
        "stats": {
            "files": len(files), "rows": total_rows,
            "humans": len(humans), "bots": len(bots), "players": len(humans) + len(bots),
            "matches": len(matches),
            "events": dict(ev_total),
        },
        "maps": maps_meta,
        "dates": dates,
        "matches": matches,
    }
    mpath = os.path.join(OUT_DATA, "manifest.json")
    with open(mpath, "w") as fh:
        json.dump(manifest, fh, separators=(",", ":"))
    print(f"  manifest.json: {len(matches)} matches  ({os.path.getsize(mpath)//1024} KB)")

    print("\nDONE.")
    print(f"  rows={total_rows} humans={len(humans)} bots={len(bots)} matches={len(matches)}")
    print(f"  events={dict(ev_total)}")
    if skipped:
        print(f"  WARNING: skipped {skipped} unreadable/malformed file(s)")
    total_oob = sum(oob.values())
    if total_oob:
        print(f"  WARNING: {total_oob} point(s) mapped outside [0,1] UV {dict(oob)} - "
              f"check the per-map scale/origin in MAP_CFG")
    else:
        print(f"  UV check: OK - all {total_rows} points fall inside [0,1] for every map")


if __name__ == "__main__":
    main()
