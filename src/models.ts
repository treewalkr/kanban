/** pi's model catalog, surfaced for the agents panel's provider/model selects. */

export interface CatalogModel {
  provider: string;
  id: string;
  context: string;
  maxOut: string;
  thinking: boolean;
  images: boolean;
}

/** Parse the fixed six-column table `pi --list-models` prints (every cell is one token). */
export function parseModelsTable(text: string): CatalogModel[] {
  const out: CatalogModel[] = [];
  for (const line of text.split("\n").slice(1)) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 6 || cols[0] === "provider") continue;
    out.push({
      provider: cols[0],
      id: cols[1],
      context: cols[2],
      maxOut: cols[3],
      thinking: cols[4] === "yes",
      images: cols[5] === "yes",
    });
  }
  return out;
}

const TTL_MS = 10 * 60_000;
let cache: { at: number; models: CatalogModel[] } | null = null;

/** Runs `pi --list-models` (cached); resolves to [] when pi is missing or fails. */
export async function listPiModels(): Promise<CatalogModel[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.models;
  try {
    const proc = Bun.spawn(["pi", "--list-models"], { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
    const [text, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
    cache = { at: Date.now(), models: code === 0 ? parseModelsTable(text) : [] };
  } catch {
    cache = { at: Date.now(), models: [] };
  }
  return cache.models;
}
