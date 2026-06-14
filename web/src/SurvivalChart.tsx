import { EVENT_COLORS } from "./theme";

export interface SurvivalPoint { t: number; alive: number; }
export interface StormWindow { min: number; max: number; median: number; count: number; }

const mmss = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
const storm = `rgb(${EVENT_COLORS.storm[0]},${EVENT_COLORS.storm[1]},${EVENT_COLORS.storm[2]})`;

interface Props {
  series: SurvivalPoint[];
  total: number;
  maxTime: number;
  currentTime: number;
  stormWindow: StormWindow | null;
  onClose: () => void;
}

const W = 244, H = 96, PAD_L = 26, PAD_R = 8, PAD_T = 8, PAD_B = 18;

export default function SurvivalChart(p: Props) {
  const { series, total, maxTime, currentTime, stormWindow } = p;
  const innerW = W - PAD_L - PAD_R, innerH = H - PAD_T - PAD_B;
  const maxAlive = Math.max(total, 1);
  const sx = (t: number) => PAD_L + (maxTime > 0 ? (t / maxTime) * innerW : 0);
  const sy = (a: number) => PAD_T + innerH - (a / maxAlive) * innerH;

  const path = series.map((pt, i) => `${i ? "L" : "M"}${sx(pt.t).toFixed(1)},${sy(pt.alive).toFixed(1)}`).join(" ");
  // alive at currentTime
  let aliveNow = total;
  for (const pt of series) { if (pt.t <= currentTime) aliveNow = pt.alive; else break; }

  return (
    <div className="survival">
      <div className="sv-head">
        <span>Players remaining</span>
        <button className="hs-close" aria-label="Close survival curve" onClick={p.onClose}>×</button>
      </div>
      <svg width={W} height={H} role="img" aria-label="Players remaining over match time">
        {/* y axis ticks */}
        <text x={PAD_L - 5} y={sy(maxAlive) + 3} className="sv-axis" textAnchor="end">{maxAlive}</text>
        <text x={PAD_L - 5} y={sy(0) + 3} className="sv-axis" textAnchor="end">0</text>
        <line x1={PAD_L} y1={sy(0)} x2={W - PAD_R} y2={sy(0)} className="sv-grid" />
        {/* storm band */}
        {stormWindow && (
          <>
            <rect x={sx(stormWindow.min)} y={PAD_T} width={Math.max(1, sx(stormWindow.max) - sx(stormWindow.min))} height={innerH} fill={storm} opacity={0.15} />
            <line x1={sx(stormWindow.median)} y1={PAD_T} x2={sx(stormWindow.median)} y2={PAD_T + innerH} stroke={storm} strokeDasharray="2 2" opacity={0.8} />
          </>
        )}
        {/* curve */}
        <path d={path} fill="none" stroke="#38bdf8" strokeWidth={1.8} />
        {/* current-time cursor */}
        <line x1={sx(currentTime)} y1={PAD_T} x2={sx(currentTime)} y2={PAD_T + innerH} stroke="#fff" strokeWidth={1} opacity={0.5} />
        <circle cx={sx(currentTime)} cy={sy(aliveNow)} r={3} fill="#fff" />
        {/* x labels */}
        <text x={PAD_L} y={H - 5} className="sv-axis" textAnchor="start">0:00</text>
        <text x={W - PAD_R} y={H - 5} className="sv-axis" textAnchor="end">{mmss(maxTime)}</text>
      </svg>
      <div className="sv-foot">
        <b style={{ color: "#38bdf8" }}>{aliveNow}</b> of {total} in match at {mmss(currentTime)}
        {stormWindow ? <> · <span style={{ color: storm }}>storm {mmss(stormWindow.min)}–{mmss(stormWindow.max)}</span></> : null}
      </div>
    </div>
  );
}
