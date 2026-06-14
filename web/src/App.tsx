import { useEffect, useMemo, useRef, useState } from "react";
import DeckMap from "./DeckMap";
import ErrorBoundary from "./ErrorBoundary";
import Sidebar from "./Sidebar";
import Timeline from "./Timeline";
import Legend from "./Legend";
import { prepare, type EventToggles, type HeatmapMode, type Prepared, type TrailMode } from "./prepare";
import type { Manifest, MapData, MapId } from "./types";
import { HUMAN_COLOR, BOT_COLOR, EVENT_COLORS, SIZE, type RGBA } from "./theme";
import Hotspots, { type HotspotMetric } from "./Hotspots";
import SurvivalChart, { type StormWindow } from "./SurvivalChart";
import Help from "./Help";
import Stats from "./Stats";
import { binGrid, playableBbox, topCells, renderToWorld } from "./grid";
import { readUrl, writeUrl, type PinData } from "./urlState";

const ALL_EVENTS: EventToggles = { kill: true, death: true, storm: true, loot: true };
const HOTSPOT_MARK: RGBA = [255, 145, 36, 255]; // unique orange for hotspot markers
const BASE = import.meta.env.BASE_URL;

export default function App() {
  const init = useRef(readUrl()).current; // shareable state restored from the URL (read once)

  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [mapId, setMapId] = useState<MapId>(init.mapId ?? "AmbroseValley");
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [loadingMap, setLoadingMap] = useState(false);
  const cache = useRef<Record<string, Prepared>>({});

  // filters
  const [dates, setDates] = useState<Set<string>>(new Set(init.dates ?? [])); // empty = all
  const [matchId, setMatchId] = useState<string | null>(init.matchId ?? null);
  const [showHumans, setShowHumans] = useState(init.showHumans ?? true);
  const [showBots, setShowBots] = useState(init.showBots ?? true);
  const [multiOnly, setMultiOnly] = useState(init.multiOnly ?? false);

  // layers
  const [showPaths, setShowPaths] = useState(init.showPaths ?? true);
  const [eventToggles, setEventToggles] = useState<EventToggles>(init.events ?? ALL_EVENTS);
  const [heatmap, setHeatmap] = useState<HeatmapMode>(init.heatmap ?? "none");
  const [heatmapOnly, setHeatmapOnly] = useState(init.heatmapOnly ?? true); // hide paths + markers while a heatmap is on
  const [trailMode, setTrailMode] = useState<TrailMode>(init.trailMode ?? "persist");

  // hotspot panel
  const [hotspotsOpen, setHotspotsOpen] = useState(init.hotspotsOpen ?? false);
  const [hotspotMetric, setHotspotMetric] = useState<HotspotMetric>(init.hotspotMetric ?? "traffic");
  const [selectedHotspot, setSelectedHotspot] = useState(-1);
  const [focus, setFocus] = useState<{ xy: [number, number]; nonce: number } | null>(null);
  const [showSurvival, setShowSurvival] = useState(init.showSurvival ?? false);
  const [spotlight, setSpotlight] = useState<{ xy: [number, number]; label: string; nonce: number } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [pins, setPins] = useState<PinData[]>(init.pins ?? []);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer (no effect ≥860px)

  // playback
  const [time, setTime] = useState(init.time ?? 0);
  const [playing, setPlaying] = useState(false);
  const [engaged, setEngaged] = useState(init.engaged ?? false); // false = overview (show everything, clock at 0:00)
  const [speed, setSpeed] = useState(init.speed ?? 25); // match-seconds per real second
  const [fitNonce, setFitNonce] = useState(0);

  // ---- load manifest ----
  useEffect(() => {
    fetch(`${BASE}data/manifest.json`).then((r) => r.json()).then(setManifest);
  }, []);

  // show the help dialog on the very first visit
  useEffect(() => {
    try {
      if (!localStorage.getItem("lila_help_seen")) { setShowHelp(true); localStorage.setItem("lila_help_seen", "1"); }
    } catch { /* ignore */ }
  }, []);

  // ---- load (and prepare) selected map ----
  useEffect(() => {
    let alive = true;
    if (cache.current[mapId]) {
      setPrepared(cache.current[mapId]);
      return;
    }
    setLoadingMap(true);
    fetch(`${BASE}data/map_${mapId}.json`)
      .then((r) => r.json())
      .then((d: MapData) => {
        const p = prepare(d);
        cache.current[mapId] = p;
        if (alive) { setPrepared(p); setLoadingMap(false); }
      });
    return () => { alive = false; };
  }, [mapId]);

  // reset the selected match when the map actually changes (not on mount, so a
  // URL-restored match survives).
  const prevMap = useRef(mapId);
  useEffect(() => {
    if (prevMap.current !== mapId) { setMatchId(null); prevMap.current = mapId; }
  }, [mapId]);

  // ---- filtered data ----
  // A selected match composes WITH the player-type toggles (match implies its date).
  const filteredJourneys = useMemo(() => {
    if (!prepared) return [];
    return prepared.journeys.filter((j) => {
      if (matchId) { if (j.match !== matchId) return false; }
      else if (dates.size && !dates.has(j.date)) return false;
      if (j.isBot && !showBots) return false;
      if (!j.isBot && !showHumans) return false;
      return true;
    });
  }, [prepared, matchId, dates, showHumans, showBots]);

  const filteredEvents = useMemo(() => {
    if (!prepared) return [];
    return prepared.events.filter((e) => {
      if (matchId) { if (e.match !== matchId) return false; }
      else if (dates.size && !dates.has(e.date)) return false;
      if (e.isBot && !showBots) return false;
      if (!e.isBot && !showHumans) return false;
      return true;
    });
  }, [prepared, matchId, dates, showHumans, showBots]);

  const maxTime = useMemo(
    () => filteredJourneys.reduce((m, j) => Math.max(m, j.dur), 0),
    [filteredJourneys]
  );

  // Live stats for the current selection. During playback (engaged) only events
  // up to the current time are counted, so the numbers tick up as the match plays.
  const liveStats = useMemo(() => {
    const effTime = engaged ? time : Infinity;
    let humans = 0, bots = 0, kills = 0, deaths = 0, loot = 0, storm = 0;
    // humans/bots = journeys still in the match at the current time (full roster in
    // overview). Counting journeys keeps humans + bots === the journey total, which
    // reads naturally; the Stats box additionally shows the unique-player count.
    for (const j of filteredJourneys) {
      if (engaged && time > j.dur) continue; // this player's journey has ended by now
      j.isBot ? bots++ : humans++;
    }
    // events = cumulative count up to the current time.
    for (const e of filteredEvents) {
      if (e.t > effTime) continue;
      if (e.cat === "kill") kills++;
      else if (e.cat === "death") deaths++;
      else if (e.cat === "storm") storm++;
      else if (e.cat === "loot") loot++;
    }
    return { humans, bots, kills, deaths, loot, storm };
  }, [filteredJourneys, filteredEvents, engaged, time]);

  // top hotspot cells for the chosen metric over the current selection
  const hotspots = useMemo(() => {
    if (!hotspotsOpen || !manifest) return { cells: [], radius: 0, worldCell: 0 };
    const meta = manifest.maps[mapId];
    const cfg = { scale: meta.scale, originX: meta.originX, originZ: meta.originZ };
    const bbox = playableBbox(meta.worldBounds, cfg);
    const gate = engaged ? time : Infinity; // during playback, rank only events so far
    let pts: [number, number][];
    if (hotspotMetric === "traffic") {
      pts = [];
      for (const j of filteredJourneys) {
        const { xy, ts } = j;
        for (let i = 0; i < xy.length; i++) if (ts[i] <= gate) pts.push(xy[i]);
      }
    } else {
      pts = filteredEvents.filter((e) => e.cat === hotspotMetric && e.t <= gate).map((e) => e.xy);
    }
    const b = binGrid(pts, bbox, 30);
    return {
      cells: topCells(b, cfg, 8),
      radius: Math.hypot(b.w, b.h) / 2, // circumscribes the square cell -> contains every counted item
      worldCell: Math.round((b.w / SIZE) * cfg.scale), // cell size in world units
    };
  }, [hotspotsOpen, hotspotMetric, manifest, mapId, filteredJourneys, filteredEvents, engaged, time]);

  useEffect(() => { setSelectedHotspot(-1); }, [hotspotMetric, mapId]);

  // storm-death window for the current selection (for the survival chart + timeline band)
  const stormWindow = useMemo<StormWindow | null>(() => {
    const ts = filteredEvents.filter((e) => e.cat === "storm").map((e) => e.t).sort((a, b) => a - b);
    if (!ts.length) return null;
    return { min: ts[0], max: ts[ts.length - 1], median: ts[Math.floor(ts.length / 2)], count: ts.length };
  }, [filteredEvents]);

  // players-remaining curve (count of journeys still in the match at each sampled time)
  const survivalSeries = useMemo(() => {
    if (!filteredJourneys.length || maxTime <= 0) return [];
    const durs = filteredJourneys.map((j) => j.dur);
    const N = 80;
    const out: { t: number; alive: number }[] = [];
    for (let i = 0; i <= N; i++) {
      const t = (maxTime * i) / N;
      let alive = 0;
      for (const d of durs) if (d >= t) alive++;
      out.push({ t, alive });
    }
    return out;
  }, [filteredJourneys, maxTime]);

  // plain-language "Stats" for the CURRENT selection. During playback everything
  // is gated to the current time, so milestones reveal as they happen and the
  // coverage/skew grow with the match.
  const stats = useMemo(() => {
    if (!manifest || !prepared) return null;
    const meta = manifest.maps[mapId];
    const cfg = { scale: meta.scale, originX: meta.originX, originZ: meta.originZ };
    const bbox = playableBbox(meta.worldBounds, cfg);
    const gate = engaged ? time : Infinity;
    // time-gated movement
    const traffic: [number, number][] = [];
    for (const j of filteredJourneys) { const { xy, ts } = j; for (let i = 0; i < xy.length; i++) if (ts[i] <= gate) traffic.push(xy[i]); }
    // Pacing for an event type, up to the current time: the FIRST player to do it
    // (earliest) and the LAST player to do it (max over each player's first), each
    // with its own location. The "first" is stable once it happens.
    const firstOf = (cat: string) => {
      const perPlayer = new Map<string, { t: number; xy: [number, number] }>();
      for (const e of filteredEvents) {
        if (e.cat !== cat || e.t > gate) continue;
        const id = e.user + "_" + e.match;
        const cur = perPlayer.get(id);
        if (!cur || e.t < cur.t) perPlayer.set(id, { t: e.t, xy: e.xy });
      }
      let first: { t: number; xy: [number, number] } | null = null, last: { t: number; xy: [number, number] } | null = null;
      for (const a of perPlayer.values()) { if (!first || a.t < first.t) first = a; if (!last || a.t > last.t) last = a; }
      if (!first || !last) return null;
      return {
        t: first.t, world: renderToWorld(first.xy[0], first.xy[1], cfg), center: first.xy,
        lastT: last.t, lastWorld: renderToWorld(last.xy[0], last.xy[1], cfg), lastCenter: last.xy,
        players: perPlayer.size,
      };
    };
    const durs = filteredJourneys.map((j) => j.dur).sort((a, b) => a - b);
    const medianSec = durs.length ? durs[Math.floor(durs.length / 2)] : 0;
    const DEATHS = new Set(["Killed", "BotKilled", "KilledByStorm"]);
    const survived = filteredJourneys.filter((j) => !j.events.some((e) => DEATHS.has(e.e))).length;
    const survivalPct = filteredJourneys.length ? Math.round((100 * survived) / filteredJourneys.length) : 0;
    // playback-aware: live survival rate = who's still in the match right now
    const aliveNow = engaged ? filteredJourneys.filter((j) => j.dur >= time).length : filteredJourneys.length;
    const alivePct = filteredJourneys.length ? Math.round((100 * aliveNow) / filteredJourneys.length) : 0;
    // journey breakdown (humans + bots === journeys) PLUS the de-duplicated unique
    // player count, shown as a separate line so the journey sum stays intuitive.
    let humans = 0, bots = 0;
    const humanSet = new Set<string>(), botSet = new Set<string>();
    for (const j of filteredJourneys) {
      if (j.isBot) { bots++; botSet.add(j.user); } else { humans++; humanSet.add(j.user); }
    }
    const uniqueHumans = humanSet.size, uniqueBots = botSet.size;
    // coverage + balance over the movement seen so far
    const cg = binGrid(traffic, bbox, 24);
    let used = 0;
    for (let cy = 0; cy < 24; cy++) for (let cx = 0; cx < 24; cx++) if (cg.counts[cy][cx] > 0) used++;
    const coveragePct = Math.round((100 * used) / (24 * 24));
    const mx = (bbox.x0 + bbox.x1) / 2, my = (bbox.y0 + bbox.y1) / 2;
    let east = 0, north = 0;
    for (const [px, py] of traffic) { if (px > mx) east++; if (py < my) north++; }
    const t = traffic.length || 1;
    const ePct = Math.round((100 * east) / t), nPct = Math.round((100 * north) / t);
    const horiz = ePct >= 58 ? `${ePct}% east` : ePct <= 42 ? `${100 - ePct}% west` : null;
    const vert = nPct >= 58 ? `${nPct}% north` : nPct <= 42 ? `${100 - nPct}% south` : null;
    const skew = horiz || vert ? [horiz, vert].filter(Boolean).join(" · ") : "fairly balanced";
    return {
      firstLoot: firstOf("loot"), firstKill: firstOf("kill"), firstDeath: firstOf("death"), firstStorm: firstOf("storm"),
      medianSec, survivalPct, aliveNow, alivePct, humans, bots, uniqueHumans, uniqueBots,
      coveragePct, skew, journeys: filteredJourneys.length,
    };
  }, [manifest, prepared, mapId, filteredJourneys, filteredEvents, engaged, time]);

  const pickLocation = (xy: [number, number], label: string) => {
    setFocus((f) => ({ xy, nonce: (f?.nonce ?? 0) + 1 }));
    setSpotlight((s) => ({ xy, label, nonce: (s?.nonce ?? 0) + 1 }));
  };

  // keep the URL in sync with the shareable view (time is dropped during playback
  // to avoid per-frame history churn).
  const lastUrl = useRef<string | null>(null);
  useEffect(() => {
    const qs = writeUrl({
      mapId, dates: [...dates], matchId, showHumans, showBots, multiOnly, showPaths,
      events: eventToggles, heatmap, heatmapOnly, trailMode, speed,
      hotspotsOpen, hotspotMetric, showSurvival,
      time: playing ? 0 : time, engaged: playing ? false : engaged, pins,
    });
    if (qs === lastUrl.current) return;
    lastUrl.current = qs;
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [mapId, dates, matchId, showHumans, showBots, multiOnly, showPaths, eventToggles, heatmap,
      heatmapOnly, trailMode, speed, hotspotsOpen, hotspotMetric, showSurvival, time, engaged, playing, pins]);

  // selection signature -> reset to overview (clock at 0:00). Skip the mount run
  // so a URL-restored playback time/engaged state isn't wiped.
  const selKey = `${mapId}|${[...dates].sort().join(",")}|${matchId}|${showHumans}|${showBots}`;
  const prevSel = useRef(selKey);
  useEffect(() => {
    if (prevSel.current !== selKey) {
      setPlaying(false); setEngaged(false); setTime(0);
      setSpotlight(null); setSelectedHotspot(-1); // drop any stale on-map markers
      prevSel.current = selKey;
    }
  }, [selKey]);

  // ---- playback loop ----
  const raf = useRef<number>(0);
  const last = useRef<number>(0);
  useEffect(() => {
    if (!playing) return;
    last.current = 0;
    const tick = (now: number) => {
      if (!last.current) last.current = now;
      const dt = (now - last.current) / 1000;
      last.current = now;
      let ended = false;
      setTime((t) => {
        const nt = t + dt * speed;
        if (nt >= maxTime) { ended = true; return maxTime; }
        return nt;
      });
      if (ended) { setPlaying(false); return; } // stop the loop at the end
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, speed, maxTime]);

  const play = () => {
    if (maxTime <= 0) return;
    setEngaged(true);
    setSpotlight(null); // don't carry a stale highlight into playback
    if (time >= maxTime) setTime(0);
    setPlaying(true);
  };

  // matches available for the picker (respecting map + date + multiplayer filter)
  const matchOptions = useMemo(() => {
    if (!manifest) return [];
    return manifest.matches
      .filter((m) => m.map === mapId)
      .filter((m) => !dates.size || dates.has(m.date))
      .filter((m) => !multiOnly || m.players >= 7)
      .sort((a, b) => b.players - a.players || b.rows - a.rows);
  }, [manifest, mapId, dates, multiOnly]);

  // if the selected match falls out of the available options (e.g. user enabled
  // "multiplayer only" or deselected its date), clear it so the picker + map agree.
  // Guard on manifest so a URL-restored match isn't wiped before the data loads.
  useEffect(() => {
    if (manifest && matchId && !matchOptions.some((m) => m.match_id === matchId)) setMatchId(null);
  }, [matchOptions, matchId, manifest]);

  if (!manifest) {
    return <div className="loading-screen">Loading LILA telemetry…</div>;
  }

  const selectedMatch = matchId ? manifest.matches.find((m) => m.match_id === matchId) ?? null : null;

  // notes/pins for the current map (world -> render space)
  const meta = manifest.maps[mapId];
  const currentPins = pins
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => p.map === mapId)
    .map(({ p, idx }) => ({
      idx,
      xy: [((p.x - meta.originX) / meta.scale) * SIZE, (1 - (p.z - meta.originZ) / meta.scale) * SIZE] as [number, number],
      text: p.text,
    }));
  const addPin = (coord: [number, number]) => {
    const u = coord[0] / SIZE, v = 1 - coord[1] / SIZE;
    const x = Math.round(u * meta.scale + meta.originX), z = Math.round(v * meta.scale + meta.originZ);
    const text = window.prompt("Note for this spot:", "");
    if (text && text.trim()) setPins((ps) => [...ps, { map: mapId, x, z, text: text.trim() }]);
  };
  const removePin = (idx: number) => setPins((ps) => ps.filter((_, i) => i !== idx));

  return (
    <div className="app">
      <header className="topbar">
        <button
          className={`nav-toggle ${sidebarOpen ? "open" : ""}`}
          aria-label="Toggle filters panel"
          aria-expanded={sidebarOpen}
          onClick={() => setSidebarOpen((o) => !o)}
        >
          <span /><span /><span />
        </button>
        <div className="brand" title="LILA BLACK — Player Journey Explorer">
          <span className="logo-mark"><Reticle /></span>
          <span className="wordmark">LILA&nbsp;BLACK</span>
          <span className="subtitle">Player Journey Explorer</span>
          {playing && <span className="live-badge">● LIVE</span>}
        </div>
        <div className="ops-status">
          <span className="ops-readout">
            <b>{manifest.stats.files.toLocaleString()}</b> files · <b>{manifest.stats.rows.toLocaleString()}</b> rows ·{" "}
            <b>{manifest.stats.players}</b> players · <b>{manifest.stats.matches}</b> matches ·{" "}
            <b>{Object.keys(manifest.maps).length}</b> maps · Feb 10–14
          </span>
        </div>
        <div className="topbar-right">
          <div className="live-stats" title={engaged ? "humans/bots still in the match + events so far, at the current time. kills/deaths include bot-vs-bot combat." : "humans + bots = journeys in the current selection (one player can play several matches — see the Stats box for unique players). kills/deaths include bot-vs-bot combat (PvE-heavy dataset)."}>
            <Stat label="humans" value={liveStats.humans} color={HUMAN_COLOR} />
            <Stat label="bots" value={liveStats.bots} color={BOT_COLOR} />
            <span className="stat-sep" />
            <Stat label="kills" value={liveStats.kills} color={EVENT_COLORS.kill} />
            <Stat label="deaths" value={liveStats.deaths} color={EVENT_COLORS.death} />
            <Stat label="loot" value={liveStats.loot} color={EVENT_COLORS.loot} />
            <Stat label="storm" value={liveStats.storm} color={EVENT_COLORS.storm} />
          </div>
          <button className="help-btn" aria-label="What am I looking at?" title="What am I looking at?" onClick={() => setShowHelp(true)}>?</button>
        </div>
      </header>
      {showHelp && <Help onClose={() => setShowHelp(false)} />}

      <div className="body">
        {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
        <Sidebar
          open={sidebarOpen}
          manifest={manifest}
          mapId={mapId}
          setMapId={setMapId}
          dates={dates}
          setDates={setDates}
          matchId={matchId}
          setMatchId={setMatchId}
          matchOptions={matchOptions}
          selectedMatch={selectedMatch}
          multiOnly={multiOnly}
          setMultiOnly={setMultiOnly}
          showHumans={showHumans}
          setShowHumans={setShowHumans}
          showBots={showBots}
          setShowBots={setShowBots}
          showPaths={showPaths}
          setShowPaths={setShowPaths}
          eventToggles={eventToggles}
          setEventToggles={setEventToggles}
          heatmap={heatmap}
          setHeatmap={setHeatmap}
          heatmapOnly={heatmapOnly}
          setHeatmapOnly={setHeatmapOnly}
          hotspotsOpen={hotspotsOpen}
          setHotspotsOpen={setHotspotsOpen}
          showSurvival={showSurvival}
          setShowSurvival={setShowSurvival}
          pinMode={pinMode}
          setPinMode={setPinMode}
          pinCount={pins.length}
          onClearPins={() => setPins([])}
          trailMode={trailMode}
          setTrailMode={setTrailMode}
          filteredCount={filteredJourneys.length}
          eventCount={filteredEvents.length}
          onResetView={() => setFitNonce((n) => n + 1)}
        />

        <main className="map-area">
          {prepared && (
            <ErrorBoundary>
            <DeckMap
              mapMeta={{ ...manifest.maps[mapId], image: `${BASE}${manifest.maps[mapId].image}` }}
              journeys={filteredJourneys}
              events={filteredEvents}
              eventToggles={eventToggles}
              showPaths={showPaths}
              trailMode={trailMode}
              heatmap={heatmap}
              heatmapOnly={heatmapOnly}
              currentTime={engaged ? time : maxTime}
              maxTime={maxTime}
              playing={playing}
              fitNonce={fitNonce}
              focus={focus}
              hotspotOverlay={hotspotsOpen ? { cells: hotspots.cells, radius: hotspots.radius, color: HOTSPOT_MARK, selected: selectedHotspot } : null}
              spotlight={spotlight}
              pinMode={pinMode}
              pins={currentPins}
              onMapClick={addPin}
              onRemovePin={removePin}
            />
            </ErrorBoundary>
          )}
          {hotspotsOpen && (
            <Hotspots
              metric={hotspotMetric}
              setMetric={setHotspotMetric}
              cells={hotspots.cells}
              worldCell={hotspots.worldCell}
              selected={selectedHotspot}
              live={engaged}
              onFocus={(xy, i) => {
                if (selectedHotspot === i) { setSelectedHotspot(-1); return; } // click again -> remove marker
                setSelectedHotspot(i);
                setFocus((f) => ({ xy, nonce: (f?.nonce ?? 0) + 1 }));
              }}
              onClose={() => setHotspotsOpen(false)}
            />
          )}
          {stats && <Stats data={stats} live={engaged} onPick={pickLocation} />}
          {showSurvival && (
            <SurvivalChart
              series={survivalSeries}
              total={filteredJourneys.length}
              maxTime={maxTime}
              currentTime={engaged ? time : maxTime}
              stormWindow={stormWindow}
              onClose={() => setShowSurvival(false)}
            />
          )}
          {loadingMap && <div className="map-loading">Loading {mapId}…</div>}
          {!loadingMap && prepared && filteredJourneys.length === 0 && (
            <div className="map-empty">No journeys match these filters.<br />Try clearing the date, match, or player-type filters.</div>
          )}
          <Legend />
          <Timeline
            time={time}
            maxTime={maxTime}
            playing={playing}
            overview={!engaged}
            stormWindow={stormWindow}
            speed={speed}
            setSpeed={setSpeed}
            onPlay={play}
            onPause={() => setPlaying(false)}
            onSeek={(t) => { setEngaged(true); setPlaying(false); setTime(t); setSpotlight(null); }}
          />
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: RGBA }) {
  return (
    <div className="stat">
      <div className="stat-value" style={{ color: `rgb(${color[0]},${color[1]},${color[2]})` }}>
        {value.toLocaleString()}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// Brand mark: an open-center weapon-sight reticle with a downward extraction chevron
// (tactical extraction shooter) + two corner targeting brackets echoing the panel motif.
function Reticle() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="square" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <line x1="12" y1="1.5" x2="12" y2="6" />
      <line x1="1.5" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22.5" y2="12" />
      <polyline points="9.5 19.5 12 22.5 14.5 19.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <path d="M2 5 L2 2 L5 2" />
      <path d="M22 19 L22 22 L19 22" />
    </svg>
  );
}
