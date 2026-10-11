# kanban — task board for the pi agent

Local-first Kanban board: Elysia API + Svelte 5 SPA + `kanban` CLI over one SQLite file.
Built for the pi coding agent to track task state; humans get the web UI, agents get the CLI.

## Layout

- `src/` — Bun/TypeScript: `db.ts` (SQLite + queries), `app.ts` (Elysia app, exports `type App`), `index.ts` (server entry), `cli.ts` + `render.ts` (CLI)
- `web/` — Vite + Svelte 5 SPA (board UI), talks to the API via Eden Treaty
- `skills/kanban/SKILL.md` — pi skill (installed to `~/.pi/agent/skills/kanban/` via `scripts/install.sh`)
- `data/kanban.db` — SQLite DB (gitignored). `KANBAN_DB` env var overrides the path (used by tests)

## Rules

- **Eden Treaty only** for frontend → backend calls; never hand-write fetch clients. Types flow from `src/app.ts`'s `export type App`
- **Svelte 5 runes syntax only** — never legacy stores or `$:` reactive statements
- **Elysia best practices** — validation with the built-in `t`, consult the `/elysiajs` skill when unsure
- SQL lives in `src/db.ts` only; the API and CLI are thin layers over its query functions
- Ports: API `4600`, web dev `5174`. Server binds `127.0.0.1` only — never expose this outside localhost

## Commit rules

- Commit often — one small, focused commit per logical change; never batch unrelated work
- Prefix with a type: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`
- Very short, one line, imperative. No body, no Co-Authored-By
