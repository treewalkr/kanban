export const LANE_COLORS = ["#7d8590", "#58a6ff", "#d29922", "#bc8cff", "#3fb950", "#ff7b72", "#39c5cf", "#e3b341"];

export function laneColor(index: number): string {
  return LANE_COLORS[index % LANE_COLORS.length];
}

export function timeAgo(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
