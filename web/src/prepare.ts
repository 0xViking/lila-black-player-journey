import { uvToXY } from "./theme";
import { eventCategory, type EventCategory, type Journey, type JourneyEvent, type MapData } from "./types";

export type HeatmapMode = "none" | "traffic" | "kill" | "death" | "loot";
export type TrailMode = "persist" | "comet";
export type EventToggles = Record<EventCategory, boolean>;

// Journey with precomputed render-space geometry (computed once per map load).
export interface PreparedJourney extends Journey {
  xy: [number, number][]; // path points in 1024-space
  ts: number[]; // timestamps (seconds), aligned with xy
}

export interface PreparedEvent {
  xy: [number, number];
  cat: EventCategory;
  raw: string;
  t: number;
  isBot: boolean;
  user: string;
  match: string;
  date: string;
}

export interface Prepared {
  map: MapData["map"];
  journeys: PreparedJourney[];
  events: PreparedEvent[];
}

export function prepare(data: MapData): Prepared {
  const journeys: PreparedJourney[] = [];
  const events: PreparedEvent[] = [];

  for (const j of data.journeys) {
    const xy: [number, number][] = j.path.map((p) => uvToXY(p[0], p[1]));
    const ts: number[] = j.path.map((p) => p[2]);
    journeys.push({ ...j, xy, ts });

    for (const ev of j.events as JourneyEvent[]) {
      const cat = eventCategory(ev.e);
      if (!cat) continue;
      events.push({
        xy: uvToXY(ev.u, ev.v),
        cat,
        raw: ev.e,
        t: ev.t,
        isBot: j.isBot,
        user: j.user,
        match: j.match,
        date: j.date,
      });
    }
  }
  return { map: data.map, journeys, events };
}
