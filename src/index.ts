import { existsSync } from "node:fs";
import { join } from "node:path";
import staticPlugin from "@elysiajs/static";
import { app } from "./app";

const port = Number(process.env.PORT ?? 4600);
const dist = join(import.meta.dir, "..", "web", "dist");

const server = app;
if (existsSync(dist)) {
  // alwaysStatic registers one route per built file (no catch-all), leaving the SPA fallback to us
  const staticRoutes = await staticPlugin({ assets: dist, prefix: "/", alwaysStatic: true, indexHTML: false });
  const index = () => new Response(Bun.file(join(dist, "index.html")));
  server.use(staticRoutes);
  server.get("/", index);
  server.get("/*", ({ path }) => (path.includes(".") ? new Response("not found", { status: 404 }) : index()));
}

server.listen({ port, hostname: "127.0.0.1" });
console.log(
  `kanban on http://127.0.0.1:${port}${existsSync(dist) ? "" : " (api only — run `bun run build` for the web ui)"}`,
);
