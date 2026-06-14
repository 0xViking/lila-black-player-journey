#!/usr/bin/env python3
"""
Reproduces the headline numbers cited in INSIGHTS.md, straight from the raw Parquet.
Run:  python etl/insights.py     (expects the raw data at data/player_data/)
"""
import os, re, glob, collections
import numpy as np
import pyarrow.parquet as pq

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "player_data")
CFG = {
    "AmbroseValley": (900, -370, -473),
    "GrandRift": (581, -290, -290),
    "Lockdown": (1000, -500, -500),
}
NUMERIC = re.compile(r"^\d+$")
DEATH = {"Killed", "BotKilled", "KilledByStorm"}


def load():
    rows = []
    for f in sorted(glob.glob(os.path.join(RAW, "February_*", "*.nakama-0"))):
        date = os.path.basename(os.path.dirname(f))
        d = pq.read_table(f).to_pandas()
        if len(d) == 0:
            continue
        d["event"] = d["event"].apply(lambda x: x.decode() if isinstance(x, (bytes, bytearray)) else x)
        uid = str(d.user_id.iloc[0]); mid = str(d.match_id.iloc[0]); mp = str(d.map_id.iloc[0])
        ts = d.ts.astype("int64").values // 10**6
        rel = ts - ts.min()
        rows.append(dict(uid=uid, mid=mid, mp=mp, date=date, df=d, rel=rel,
                         is_bot=bool(NUMERIC.match(uid)), events=list(d.event)))
    return rows


def main():
    R = load()
    ev = collections.Counter()
    for r in R:
        ev.update(r["events"])
    n_rows = sum(len(r["df"]) for r in R)
    humans = {r["uid"] for r in R if not r["is_bot"]}
    bots = {r["uid"] for r in R if r["is_bot"]}
    matches = {r["mid"] for r in R}

    print(f"== Base ==  files={len(R)} rows={n_rows} humans={len(humans)} bots={len(bots)} matches={len(matches)}")
    print(f"   events={dict(ev)}")

    # --- Insight 1: PvP vs PvE ---
    pvp = ev["Kill"] + ev["Killed"]
    pve = ev["BotKill"] + ev["BotKilled"]
    print("\n== Insight 1: PvP void ==")
    print(f"   PvP(Kill+Killed)={pvp}  PvE(BotKill+BotKilled)={pve}  ratio={pve/max(pvp,1):.0f}:1")
    # self-pair artifact
    arts = 0
    for r in R:
        d = r["df"]
        if "Kill" in r["events"] and "Killed" in r["events"]:
            k = d[d.event == "Kill"][["x", "z"]].round(2).values.tolist()
            kd = d[d.event == "Killed"][["x", "z"]].round(2).values.tolist()
            if any(p in kd for p in k):
                arts += 1
    print(f"   files where a Kill and a Killed share identical (x,z): {arts}  (=> self-logged, not real PvP)")
    bk = sum(1 for r in R if not r["is_bot"] for e in r["events"] if e == "BotKill")
    bkd = sum(1 for r in R if not r["is_bot"] for e in r["events"] if e == "BotKilled")
    print(f"   human-file K/D vs bots = {bk}/{bkd} = {bk/max(bkd,1):.1f}:1")
    # match composition
    comp = collections.defaultdict(lambda: [set(), set()])
    for r in R:
        comp[r["mid"]][1 if r["is_bot"] else 0].add(r["uid"])
    one_human = sum(1 for m in comp.values() if len(m[0]) == 1)
    print(f"   matches with exactly 1 human: {one_human}/{len(matches)}")

    # --- Insight 2: dead zones & traffic concentration (per map, 20x20) ---
    print("\n== Insight 2: dead zones & traffic funnel ==")
    for mp, (scale, ox, oz) in CFG.items():
        traffic = collections.Counter()
        umin = vmin = 1e9; umax = vmax = -1e9
        for r in R:
            if r["mp"] != mp:
                continue
            d = r["df"]
            move = d[d.event.isin(["Position", "BotPosition"])]
            for x, z in zip(move.x.values, move.z.values):
                u = (x - ox) / scale; v = (z - oz) / scale
                umin, umax = min(umin, u), max(umax, u); vmin, vmax = min(vmin, v), max(vmax, v)
                traffic[(int(u * 20), int(v * 20))] += 1
        # playable bbox cells
        cells = [(cu, cv) for cu in range(int(umin*20), int(umax*20)+1) for cv in range(int(vmin*20), int(vmax*20)+1)]
        empty = sum(1 for c in cells if traffic.get(c, 0) == 0)
        total = sum(traffic.values())
        srt = sorted(traffic.values(), reverse=True)
        half = 0; need = 0
        for c in srt:
            half += c; need += 1
            if half >= total / 2:
                break
        print(f"   {mp:13} playable_cells={len(cells):4} empty={empty} ({100*empty/len(cells):.1f}%)  "
              f"50% of traffic in top {need}/{len(traffic)} cells ({100*need/len(traffic):.1f}%)")

    # --- Insight 3: bot vs human movement ---
    print("\n== Insight 3: bot vs human ==")
    def stats(group):
        durs, speeds, loots, n = [], [], 0, 0
        for r in R:
            if r["is_bot"] != group:
                continue
            n += 1
            durs.append(int(r["rel"].max()))
            d = r["df"]
            move = d[d.event.isin(["Position", "BotPosition"])].sort_values("ts")
            if len(move) > 1:
                dx = np.diff(move.x.values); dz = np.diff(move.z.values)
                plen = float(np.sum(np.sqrt(dx*dx + dz*dz)))
                dur = max(int(r["rel"].max()), 1)
                speeds.append(plen / dur)
            if "Loot" in r["events"]:
                loots += 1
        return n, np.median(durs), np.median(speeds), 100*loots/max(n, 1)
    for label, g in [("humans", False), ("bots", True)]:
        n, md, ms, lp = stats(g)
        print(f"   {label:7} n={n:4}  median_dur={md:.0f}s  median_speed={ms:.2f} u/s  loot>=1 in {lp:.1f}% of journeys")

    # --- Bonus: BotKilled owner-relative, daily decline, retention ---
    print("\n== Bonus: data quality ==")
    bk_human = sum(1 for r in R if not r["is_bot"] for e in r["events"] if e == "BotKilled")
    bk_bot = sum(1 for r in R if r["is_bot"] for e in r["events"] if e == "BotKilled")
    print(f"   BotKilled in human files={bk_human}, in bot files={bk_bot}  "
          f"(summing all as human deaths overstates by {100*bk_bot/max(bk_human,1):.0f}%)")
    by_day = collections.Counter(r["date"] for r in R)
    hum_by_day = collections.defaultdict(set)
    for r in R:
        if not r["is_bot"]:
            hum_by_day[r["date"]].add(r["uid"])
    days = sorted(by_day)
    print(f"   files/day = {[by_day[d] for d in days]}  (decline {100*(by_day[days[0]]-by_day[days[-1]])/by_day[days[0]]:.0f}%)")
    print(f"   unique humans/day = {[len(hum_by_day[d]) for d in days]}")
    human_days = collections.defaultdict(set)
    for r in R:
        if not r["is_bot"]:
            human_days[r["uid"]].add(r["date"])
    ret2 = sum(1 for ds in human_days.values() if len(ds) >= 2)
    print(f"   humans returning on >=2 days: {ret2}/{len(humans)} ({100*ret2/len(humans):.1f}%)")


if __name__ == "__main__":
    main()
