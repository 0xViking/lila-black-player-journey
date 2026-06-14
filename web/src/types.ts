// Shapes of the JSON emitted by etl/build_data.py

export type MapId = "AmbroseValley" | "GrandRift" | "Lockdown";

export interface MapMeta {
  scale: number;
  originX: number;
  originZ: number;
  image: string;
  imageW: number;
  imageH: number;
  worldBounds: { xmin: number; xmax: number; zmin: number; zmax: number };
  rows: number;
  matches: number;
  journeys: number;
}

export interface Manifest {
  stats: {
    files: number;
    rows: number;
    humans: number;
    bots: number;
    players: number;
    matches: number;
    events: Record<string, number>;
  };
  maps: Record<MapId, MapMeta>;
  dates: string[];
  matches: MatchMeta[];
}

export interface MatchMeta {
  match_id: string;
  map: MapId;
  date: string;
  humans: number;
  bots: number;
  players: number;
  kills: number;
  deaths: number;
  loot: number;
  storm: number;
  rows: number;
  dur: number;
}

// [u, v, t] — u,v in 0..1 minimap space, t in seconds of match time
export type PathPoint = [number, number, number];

export interface JourneyEvent {
  e: string; // raw event name
  u: number;
  v: number;
  t: number;
}

export interface Journey {
  id: string;
  match: string;
  user: string;
  isBot: boolean;
  date: string;
  dur: number;
  path: PathPoint[];
  events: JourneyEvent[];
}

export interface MapData {
  map: MapId;
  config: { scale: number; originX: number; originZ: number };
  journeys: Journey[];
}

// UI categories for discrete events
export type EventCategory = "kill" | "death" | "storm" | "loot";

export function eventCategory(e: string): EventCategory | null {
  switch (e) {
    case "Kill":
    case "BotKill":
      return "kill";
    case "Killed":
    case "BotKilled":
      return "death";
    case "KilledByStorm":
      return "storm";
    case "Loot":
      return "loot";
    default:
      return null;
  }
}
