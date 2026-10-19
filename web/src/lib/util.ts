// Lane accents follow pi-web's theme accents: pastels on dark (a4c2f4 blue,
// e8b27a ember, cdb4f0 dusk, acccb7 pine…), deeper hues on light. Defined as
// --lane-N custom properties in app.css.
const LANE_COUNT = 8;

export function laneColor(index: number): string {
  return `var(--lane-${index % LANE_COUNT}, var(--text-dim))`;
}

export function timeAgo(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
