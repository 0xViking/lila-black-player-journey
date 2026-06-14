import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import { OrthographicView, LinearInterpolator, type OrthographicViewState, type PickingInfo } from "@deck.gl/core";
import { BitmapLayer, ScatterplotLayer, IconLayer, TextLayer } from "@deck.gl/layers";
import { TripsLayer } from "@deck.gl/geo-layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { SIZE, HUMAN_COLOR, BOT_COLOR, type RGBA } from "./theme";
import { buildMarkerAtlas } from "./markers";
import type { HotCell } from "./Hotspots";

interface HotspotOverlay { cells: HotCell[]; radius: number; color: RGBA; selected: number; }
import type { MapMeta } from "./types";
import type { PreparedJourney, PreparedEvent, EventToggles, HeatmapMode, TrailMode } from "./prepare";

// Precise, owner-aware description for the hover tooltip.
function describeEvent(raw: string, isBot: boolean): string {
  switch (raw) {
    case "BotKill": return isBot ? "Bot got a kill" : "Human killed a bot";
    case "BotKilled": return isBot ? "Bot was killed" : "Human killed by a bot";
    case "Kill": return "Human killed a human";
    case "Killed": return "Human killed by a human";
    case "KilledByStorm": return "Killed by the storm";
    case "Loot": return isBot ? "Bot picked up an item" : "Looted an item";
    default: return raw;
  }
}

// mm:ss formatter for match-relative seconds (shared semantics with Timeline).
const mmss = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

const tooltipStyle = { background: "rgba(12,14,22,0.95)", color: "#e8edf6", fontSize: "12px", padding: "6px 8px", borderRadius: "6px", border: "1px solid #2a3344" };

const HEAT_RANGE: [number, number, number][] = [
  [12, 44, 132],
  [34, 94, 168],
  [29, 145, 192],
  [65, 182, 196],
  [127, 205, 187],
  [199, 233, 180],
  [255, 255, 140],
  [254, 178, 76],
  [240, 59, 32],
  [189, 0, 38],
];

interface Props {
  mapMeta: MapMeta;
  journeys: PreparedJourney[]; // already filtered
  events: PreparedEvent[]; // already filtered by player-type; gated here by toggles + time
  eventToggles: EventToggles;
  showPaths: boolean;
  trailMode: TrailMode;
  heatmap: HeatmapMode;
  heatmapOnly: boolean;
  currentTime: number;
  maxTime: number;
  playing: boolean;
  fitNonce: number; // bump to refit view
  focus: { xy: [number, number]; nonce: number } | null; // fly-to from the hotspot panel
  hotspotOverlay: HotspotOverlay | null; // ranked hotspot markers on the map
  spotlight: { xy: [number, number]; label: string; nonce: number } | null; // highlighted location
  pinMode: boolean;
  pins: { idx: number; xy: [number, number]; text: string }[];
  onMapClick: (coord: [number, number]) => void;
  onRemovePin: (idx: number) => void;
}

const VIEW = new OrthographicView({ id: "ortho", flipY: true });
const FLY = new LinearInterpolator(["target", "zoom"]);

function fit(w: number, h: number): OrthographicViewState {
  const zoom = Math.log2((Math.min(w, h) * 0.92) / SIZE);
  return { target: [SIZE / 2, SIZE / 2, 0], zoom, minZoom: -4, maxZoom: 6 };
}

export default function DeckMap(props: Props) {
  const {
    mapMeta, journeys, events, eventToggles, showPaths, trailMode,
    heatmap, heatmapOnly, currentTime, maxTime, playing, fitNonce, focus, hotspotOverlay, spotlight,
    pinMode, pins, onMapClick, onRemovePin,
  } = props;

  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const userMoved = useRef(false);
  const [viewState, setViewState] = useState<OrthographicViewState>(() => fit(1000, 800));

  // refit on map change or explicit "Reset view"
  useEffect(() => {
    userMoved.current = false;
    if (size) setViewState(fit(size.w, size.h));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapMeta.image, fitNonce]);
  // refit when the canvas size becomes known / changes, unless the user has taken control
  useEffect(() => {
    if (size && !userMoved.current) setViewState(fit(size.w, size.h));
  }, [size]);

  // fly to a hotspot cell when the panel requests it
  useEffect(() => {
    if (!focus) return;
    userMoved.current = true;
    setViewState((vs: any) => ({
      ...vs, target: [focus.xy[0], focus.xy[1], 0], zoom: 2.4,
      transitionDuration: 600, transitionInterpolator: FLY,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  const markerAtlas = useMemo(() => buildMarkerAtlas(), []);

  // discrete events visible given toggles + (during playback) time gating
  const visibleEvents = useMemo(() => {
    const timeGate = playing || currentTime < maxTime;
    return events.filter((ev) => {
      if (!eventToggles[ev.cat]) return false;
      if (timeGate && ev.t > currentTime) return false;
      return true;
    });
  }, [events, eventToggles, playing, currentTime, maxTime]);

  // live "heads" — interpolated current position of each journey during playback
  const heads = useMemo(() => {
    if (!(playing || currentTime < maxTime)) return [];
    const out: { xy: [number, number]; isBot: boolean; user: string }[] = [];
    for (const j of journeys) {
      const ts = j.ts;
      if (ts.length < 2 || currentTime < ts[0] || currentTime > j.dur) continue;
      // find segment (i stays in [1, ts.length-1])
      let i = 1;
      while (i < ts.length && ts[i] < currentTime) i++;
      if (i >= ts.length) i = ts.length - 1;
      const t0 = ts[i - 1], t1 = ts[i];
      // clamp to [0,1] so the head rests at the last sampled position instead of
      // extrapolating off the path end (path data can stop before j.dur).
      const f = t1 > t0 ? Math.min(1, Math.max(0, (currentTime - t0) / (t1 - t0))) : 0;
      const a = j.xy[i - 1], b = j.xy[i];
      out.push({ xy: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], isBot: j.isBot, user: j.user });
    }
    return out;
  }, [journeys, currentTime, maxTime, playing]);

  // Heatmap source points. Built from the full selection (NOT the marker toggles
  // or the playback time), so a heatmap always shows the whole picture and is
  // independent of which event markers happen to be toggled on.
  const heatPoints = useMemo(() => {
    if (heatmap === "none") return [];
    if (heatmap === "traffic") {
      const pts: { xy: [number, number] }[] = [];
      for (const j of journeys) for (const p of j.xy) pts.push({ xy: p });
      return pts;
    }
    const cat = heatmap; // kill | death | loot
    return events.filter((e) => e.cat === cat).map((e) => ({ xy: e.xy }));
  }, [heatmap, journeys, events]);

  const heatActive = heatmap !== "none";
  const heatOnly = heatActive && heatmapOnly; // show just the heatmap over the minimap
  const dimPaths = heatActive && !heatOnly; // dim overlaid paths when heatmap + overlay
  const trailLength = trailMode === "comet" ? 25 : Math.max(maxTime, 1) * 6;

  const layers: any[] = [
    new BitmapLayer({
      id: `minimap-${mapMeta.image}`,
      image: mapMeta.image,
      bounds: [0, SIZE, SIZE, 0], // [left, bottom, right, top] -> upright in flipY view
      opacity: heatOnly ? 0.85 : dimPaths ? 0.55 : 1,
    }),
  ];

  if (heatmap !== "none") {
    layers.push(
      new HeatmapLayer<{ xy: [number, number] }>({
        id: `heat-${heatmap}`,
        data: heatPoints,
        getPosition: (d) => d.xy,
        getWeight: 1,
        radiusPixels: heatmap === "traffic" ? 26 : 38,
        intensity: 1,
        threshold: 0.05,
        colorRange: HEAT_RANGE,
        aggregation: "SUM",
      })
    );
  }

  if (showPaths && !heatOnly) {
    layers.push(
      new TripsLayer<PreparedJourney>({
        id: "trips",
        data: journeys,
        getPath: (j) => j.xy,
        getTimestamps: (j) => j.ts,
        getColor: (j) => (j.isBot ? BOT_COLOR : HUMAN_COLOR).slice(0, 3) as [number, number, number],
        opacity: dimPaths ? 0.5 : 0.9,
        widthMinPixels: 1.5,
        widthMaxPixels: 4,
        jointRounded: true,
        capRounded: true,
        fadeTrail: true,
        trailLength,
        currentTime,
      })
    );
  }

  // live heads
  if (heads.length && !heatOnly) {
    layers.push(
      new ScatterplotLayer<{ xy: [number, number]; isBot: boolean }>({
        id: "heads",
        data: heads,
        getPosition: (d) => d.xy,
        getFillColor: (d) => (d.isBot ? BOT_COLOR : HUMAN_COLOR),
        getLineColor: [10, 12, 20, 255],
        lineWidthMinPixels: 1,
        stroked: true,
        getRadius: 6,
        radiusUnits: "pixels",
      })
    );
  }

  // discrete events: an owner-colored ring (blue=human, pink=bot) under a
  // category glyph (kill/death/loot/storm). The ring makes it obvious *who* the
  // event happened to — e.g. a bot's own death (BotKilled in a bot file) gets a
  // pink ring, not a human-looking marker.
  if (visibleEvents.length && !heatOnly) {
    layers.push(
      new ScatterplotLayer<PreparedEvent>({
        id: "event-rings",
        data: visibleEvents,
        getPosition: (e) => e.xy,
        stroked: true,
        filled: false,
        radiusUnits: "pixels",
        getRadius: (e) => (e.cat === "loot" ? 8 : 10),
        lineWidthUnits: "pixels",
        getLineWidth: 2,
        getLineColor: (e) => (e.isBot ? BOT_COLOR : HUMAN_COLOR),
      })
    );
    layers.push(
      new IconLayer<PreparedEvent>({
        id: "events",
        data: visibleEvents,
        pickable: true,
        iconAtlas: markerAtlas.atlas,
        iconMapping: markerAtlas.mapping,
        getIcon: (e) => e.cat,
        getPosition: (e) => e.xy,
        getSize: (e) => (e.cat === "loot" ? 13 : 16),
        sizeUnits: "pixels",
        billboard: false,
        alphaCutoff: 0.05,
      })
    );
  }

  // hotspot marker: ONLY the clicked cell — its catchment circle (circumscribes
  // the counted cell) + a numbered badge in the unique hotspot color.
  if (hotspotOverlay && hotspotOverlay.selected >= 0 && hotspotOverlay.cells[hotspotOverlay.selected]) {
    const ho = hotspotOverlay;
    const one = [ho.cells[ho.selected]];
    const c3 = [ho.color[0], ho.color[1], ho.color[2]] as [number, number, number];
    layers.push(
      new ScatterplotLayer<HotCell>({
        id: "hs-area", data: one,
        getPosition: (d) => d.center, getRadius: ho.radius, radiusUnits: "common",
        stroked: true, filled: true, getFillColor: [...c3, 30], getLineColor: [...c3, 255],
        lineWidthUnits: "pixels", getLineWidth: 2.5,
      })
    );
    layers.push(
      new ScatterplotLayer<HotCell>({
        id: "hs-badge", data: one, pickable: true,
        getPosition: (d) => d.center, getRadius: 12, radiusUnits: "pixels",
        getFillColor: [...c3, 255], stroked: true, getLineColor: [10, 12, 20, 255], lineWidthMinPixels: 1.5,
      })
    );
    layers.push(
      new TextLayer<HotCell>({
        id: "hs-num", data: one,
        getPosition: (d) => d.center, getText: () => String(ho.selected + 1),
        getColor: [10, 12, 20, 255], getSize: 12, sizeUnits: "pixels",
        fontFamily: "monospace", fontWeight: 700, getTextAnchor: "middle", getAlignmentBaseline: "center",
        updateTriggers: { getText: ho.selected },
      })
    );
  }

  // spotlight: a highlighted ring + label at a picked Stats / location
  if (spotlight) {
    layers.push(
      new ScatterplotLayer<{ xy: [number, number] }>({
        id: "spotlight-ring",
        data: [{ xy: spotlight.xy }],
        getPosition: (d) => d.xy,
        getRadius: 15,
        radiusUnits: "pixels",
        stroked: true,
        filled: false,
        getLineColor: [56, 189, 248, 255],
        lineWidthMinPixels: 2.5,
      })
    );
    layers.push(
      new TextLayer<{ xy: [number, number]; label: string }>({
        id: "spotlight-label",
        data: [{ xy: spotlight.xy, label: spotlight.label }],
        getPosition: (d) => d.xy,
        getText: (d) => d.label,
        getColor: [232, 237, 246, 255],
        getSize: 12,
        sizeUnits: "pixels",
        fontWeight: 700,
        getPixelOffset: [0, -22],
        outlineWidth: 3,
        outlineColor: [8, 10, 18, 230],
        fontSettings: { sdf: true },
        background: true,
        getBackgroundColor: [12, 14, 22, 220],
        backgroundPadding: [5, 2],
      })
    );
  }

  // note pins (markers + labels). Pins are clickable to delete.
  if (pins.length) {
    layers.push(
      new ScatterplotLayer<{ idx: number; xy: [number, number]; text: string }>({
        id: "pins",
        data: pins,
        pickable: true,
        getPosition: (d) => d.xy,
        getRadius: 7,
        radiusUnits: "pixels",
        getFillColor: [250, 204, 21, 255],
        stroked: true,
        getLineColor: [20, 20, 24, 255],
        lineWidthMinPixels: 1.5,
      })
    );
    layers.push(
      new TextLayer<{ idx: number; xy: [number, number]; text: string }>({
        id: "pin-labels",
        data: pins,
        pickable: true,
        getPosition: (d) => d.xy,
        getText: (d) => d.text,
        characterSet: "auto",
        getColor: [255, 255, 255, 255],
        getSize: 12,
        sizeUnits: "pixels",
        fontWeight: 600,
        getPixelOffset: [0, -13],
        background: true,
        getBackgroundColor: [30, 26, 8, 230],
        backgroundPadding: [5, 2],
        getTextAnchor: "middle",
        getAlignmentBaseline: "bottom",
        updateTriggers: { getText: pins.map((p) => p.text).join("|") },
      })
    );
  }

  const getTooltip = useCallback((info: PickingInfo) => {
    const o = info.object as any;
    if (o && typeof o.idx === "number" && typeof o.text === "string") {
      return { html: `<b>📍 ${o.text}</b><br/><span style="color:#8d97ab">click to delete</span>`, style: tooltipStyle };
    }
    if (o && Array.isArray(o.world) && typeof o.count === "number") {
      return {
        html: `<b>Hotspot</b><br/>world (${o.world[0]}, ${o.world[1]})<br/>${o.count.toLocaleString()} in this cell`,
        style: tooltipStyle,
      };
    }
    const e = info.object as PreparedEvent | undefined;
    if (!e || !e.cat) return null;
    return {
      html: `<b>${describeEvent(e.raw, e.isBot)}</b><br/>${e.isBot ? "🤖 bot" : "🧑 human"} ${e.user.slice(0, 8)} · ${e.raw}<br/>at ${mmss(e.t)}`,
      style: tooltipStyle,
    };
  }, []);

  return (
    <div className="deck-container">
      <DeckGL
        views={VIEW}
        viewState={viewState as any}
        controller={{ doubleClickZoom: false }}
        onResize={({ width, height }: { width: number; height: number }) => setSize({ w: width, h: height })}
        onViewStateChange={(e: any) => {
          const is = e.interactionState;
          if (is && (is.isDragging || is.isZooming || is.isPanning)) userMoved.current = true;
          setViewState(e.viewState);
        }}
        onClick={(info: any) => {
          const o = info.object;
          if (o && typeof o.idx === "number" && typeof o.text === "string") { onRemovePin(o.idx); return; }
          if (pinMode && info.coordinate) onMapClick([info.coordinate[0], info.coordinate[1]]);
        }}
        getCursor={({ isDragging }: { isDragging: boolean }) => (isDragging ? "grabbing" : pinMode ? "crosshair" : "default")}
        layers={layers}
        getTooltip={getTooltip as any}
        style={{ background: "#0b0d14" }}
      />
    </div>
  );
}
