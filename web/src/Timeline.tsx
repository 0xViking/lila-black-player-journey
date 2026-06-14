const SPEEDS = [10, 25, 50, 100];

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

interface StormWindow { min: number; max: number; median: number; count: number; }

interface Props {
  time: number;
  maxTime: number;
  playing: boolean;
  overview: boolean;
  stormWindow: StormWindow | null;
  speed: number;
  setSpeed: (n: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (t: number) => void;
}

export default function Timeline(p: Props) {
  const pct = p.maxTime > 0 ? (p.time / p.maxTime) * 100 : 0;
  const disabled = p.maxTime <= 0;
  return (
    <div className="timeline">
      <button className="play-btn" disabled={disabled} aria-label={p.playing ? "Pause" : "Play"} onClick={p.playing ? p.onPause : p.onPlay}>
        {p.playing ? "❚❚" : "▶"}
      </button>
      <div className="time-read">{fmt(p.time)}</div>
      <div className="scrub-wrap">
        {p.stormWindow && p.maxTime > 0 && (
          <div
            className="storm-band"
            title={`Storm deaths ${fmt(p.stormWindow.min)}-${fmt(p.stormWindow.max)} (median ${fmt(p.stormWindow.median)})`}
            style={{ left: `${(p.stormWindow.min / p.maxTime) * 100}%`, width: `${Math.max(0.5, ((p.stormWindow.max - p.stormWindow.min) / p.maxTime) * 100)}%` }}
          />
        )}
        <input
          className="scrub"
          type="range"
          aria-label="Match time"
          min={0}
          max={Math.max(p.maxTime, 0.001)}
          step={0.5}
          value={Math.min(p.time, p.maxTime)}
          disabled={disabled}
          onChange={(e) => p.onSeek(parseFloat(e.target.value))}
          style={{ background: `linear-gradient(to right, #38bdf8 ${pct}%, #2a3344 ${pct}%)` }}
        />
      </div>
      <div className="time-read muted">{fmt(p.maxTime)}</div>
      <div className="speed" role="group" aria-label="Playback speed">
        {SPEEDS.map((s) => (
          <button key={s} className={`spd ${p.speed === s ? "active" : ""}`} aria-pressed={p.speed === s} onClick={() => p.setSpeed(s)}>
            {s}×
          </button>
        ))}
      </div>
      <div className="tl-hint">{p.overview ? "overview · ▶ to play" : "match time"}</div>
    </div>
  );
}
