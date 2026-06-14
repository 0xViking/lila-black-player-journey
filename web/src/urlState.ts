import type { EventToggles, HeatmapMode, TrailMode } from "./prepare";
import type { MapId } from "./types";
import type { HotspotMetric } from "./Hotspots";

// Serialize the shareable view into the URL query string so a specific
// map+match+filters+time+heatmap view is a single copyable link.

export interface UrlState {
  mapId: MapId;
  dates: string[]; // folder names e.g. "February_10"
  matchId: string | null;
  showHumans: boolean;
  showBots: boolean;
  multiOnly: boolean;
  showPaths: boolean;
  events: EventToggles;
  heatmap: HeatmapMode;
  heatmapOnly: boolean;
  trailMode: TrailMode;
  speed: number;
  hotspotsOpen: boolean;
  hotspotMetric: HotspotMetric;
  showSurvival: boolean;
  time: number;
  engaged: boolean;
  pins: PinData[];
}

export interface PinData { map: MapId; x: number; z: number; text: string; }

const MAP_CODE: Record<MapId, string> = { AmbroseValley: "a", GrandRift: "g", Lockdown: "l" };
const CODE_MAP: Record<string, MapId> = { a: "AmbroseValley", g: "GrandRift", l: "Lockdown" };
const HEAT_CODE: Record<HeatmapMode, string> = { none: "", traffic: "tr", kill: "k", death: "de", loot: "lo" };
const CODE_HEAT: Record<string, HeatmapMode> = { tr: "traffic", k: "kill", de: "death", lo: "loot" };
const HS_CODE: Record<HotspotMetric, string> = { traffic: "tr", kill: "k", death: "de", loot: "lo" };
const CODE_HS: Record<string, HotspotMetric> = { tr: "traffic", k: "kill", de: "death", lo: "loot" };
const day = (folder: string) => folder.replace("February_", "");
const folder = (d: string) => `February_${d}`;
const evStr = (e: EventToggles) => `${e.kill ? "k" : ""}${e.death ? "d" : ""}${e.storm ? "s" : ""}${e.loot ? "l" : ""}`;

export function writeUrl(s: UrlState): string {
  const p = new URLSearchParams();
  p.set("m", MAP_CODE[s.mapId]);
  if (s.dates.length) p.set("d", s.dates.map(day).join("."));
  if (s.matchId) p.set("mt", s.matchId);
  if (!s.showHumans) p.set("sh", "0");
  if (!s.showBots) p.set("sb", "0");
  if (s.multiOnly) p.set("mo", "1");
  if (!s.showPaths) p.set("pa", "0");
  const ev = evStr(s.events);
  if (ev !== "kdsl") p.set("ev", ev);
  if (s.heatmap !== "none") p.set("hm", HEAT_CODE[s.heatmap]);
  if (!s.heatmapOnly) p.set("ho", "0");
  if (s.trailMode === "comet") p.set("tm", "c");
  if (s.speed !== 25) p.set("sp", String(s.speed));
  if (s.hotspotsOpen) { p.set("hs", "1"); if (s.hotspotMetric !== "traffic") p.set("hsm", HS_CODE[s.hotspotMetric]); }
  if (s.showSurvival) p.set("sv", "1");
  if (s.engaged && s.time > 0) p.set("t", String(Math.round(s.time)));
  if (s.pins.length) p.set("pn", s.pins.map((pin) => `${MAP_CODE[pin.map]}~${pin.x}~${pin.z}~${encodeURIComponent(pin.text)}`).join("|"));
  return p.toString();
}

export function readUrl(): Partial<UrlState> {
  const p = new URLSearchParams(window.location.search);
  const out: Partial<UrlState> = {};
  const m = p.get("m"); if (m && CODE_MAP[m]) out.mapId = CODE_MAP[m];
  const d = p.get("d"); if (d) out.dates = d.split(".").map(folder);
  const mt = p.get("mt"); if (mt) out.matchId = mt;
  if (p.get("sh") === "0") out.showHumans = false;
  if (p.get("sb") === "0") out.showBots = false;
  if (p.get("mo") === "1") out.multiOnly = true;
  if (p.get("pa") === "0") out.showPaths = false;
  const ev = p.get("ev");
  if (ev != null) out.events = { kill: ev.includes("k"), death: ev.includes("d"), storm: ev.includes("s"), loot: ev.includes("l") };
  const hm = p.get("hm"); if (hm && CODE_HEAT[hm]) out.heatmap = CODE_HEAT[hm];
  if (p.get("ho") === "0") out.heatmapOnly = false;
  if (p.get("tm") === "c") out.trailMode = "comet";
  const sp = p.get("sp"); if (sp && !isNaN(+sp)) out.speed = +sp;
  if (p.get("hs") === "1") out.hotspotsOpen = true;
  const hsm = p.get("hsm"); if (hsm && CODE_HS[hsm]) out.hotspotMetric = CODE_HS[hsm];
  if (p.get("sv") === "1") out.showSurvival = true;
  const t = p.get("t"); if (t && !isNaN(+t)) { out.time = +t; out.engaged = true; }
  const pn = p.get("pn");
  if (pn) {
    out.pins = pn.split("|").map((s) => {
      const [m, x, z, ...rest] = s.split("~");
      return { map: CODE_MAP[m] ?? "AmbroseValley", x: +x, z: +z, text: decodeURIComponent(rest.join("~")) };
    }).filter((pin) => CODE_MAP[MAP_CODE[pin.map]] && !isNaN(pin.x) && !isNaN(pin.z));
  }
  return out;
}
