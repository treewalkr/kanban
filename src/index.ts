import { existsSync } from "node:fs";
import { join } from "node:path";
import staticPlugin from "@elysiajs/static";
import { app } from "./app";

const port = Number(process.env.PORT ?? 4600);
const dist = join(import.meta.dir, "..", "web", "dist");

const server = app;
if (existsSync(dist)) {
  const staticRoutes = await staticPlugin({ assets: dist, prefix: "/" });
  server.use(staticRoutes);
  // SPA fallback: unknown GET paths (no file extension) get index.html
  server.get("*", ({ path }) => {
    if (path.includes(".")) return new Response("not found", { status: 404 });
    return new Response(Bun.file(join(dist, "index.html")));
  });
}

server.listen({ port, hostname: "127.0.0.1" });
console.log(
  `kanban on http://127.0.0.1:${port}${existsSync(dist) ? "" : " (api only — run `bun run build` for the web ui)"}`,
);
