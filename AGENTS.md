# kanban — task board for the pi agent

Local-first Kanban board: Elysia API + Svelte 5 SPA + `kanban` CLI over one SQLite file. Humans get the web UI, agents get the CLI.

## Layout

- `src/` — Bun/TS: `db.ts` (SQLite + all queries), `app.ts` (Elysia app, exports `type App`), `index.ts` (server entry), `cli.ts` + `render.ts` (CLI)
- `web/` — Vite + Svelte 5 SPA (board UI), calls the API via Eden Treaty
- `skills/kanban/SKILL.md` — pi skill, installed to `~/.pi/agent/skills/kanban/` by `scripts/install.sh`
- `data/kanban.db` — SQLite DB (gitignored); `KANBAN_DB` env var overrides the path (tests use this)

## Rules

- **Eden Treaty only** for frontend → backend calls; types flow from `src/app.ts`'s `export type App`
- **Svelte 5 runes only** — no legacy stores, no `$:` reactive statements
- **Elysia built-in `t`** for validation; consult the `/elysiajs` skill when unsure
- SQL lives in `src/db.ts` only; the API and CLI are thin layers over its query functions
- Ports: API `4600`, web dev `5174`; server binds `127.0.0.1` only — never expose off localhost
- After plan approval, attach the plan to its card before implementing: write it to a file, run `kanban attach <id> <plan-file>`; re-attaching a revised plan versions it

## Commits

- Commit often: one small, focused commit per logical change; never batch unrelated work
- Prefix with a type: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`
- One line, imperative, no body, no Co-Authored-By

## ADHD-friendly output

The reader has ADHD. Shape every response so it can be acted on, not just understood. These rules apply every turn for the whole session; turn off only when the reader says "stop adhd mode" or "normal mode" (confirm in one line).

Why: working memory is small (off-screen is forgotten), starting is the hardest step, time estimates all read the same, and invisible progress doesn't register.

1. **Lead with the next action.** First line = something the reader can do now. Commands, paths, and snippets go first; prose after, if at all.
2. **Number multi-step work.** Fewest bounded steps that still work — no step with two "and then"s; fold trivial steps into the previous one. A finished short path beats an abandoned complete one.
3. **End with one concrete next action** the reader can do in under two minutes, if anything is open.
4. **One issue per response.** Finish the first; offer the second as a separate question at the end. A question you can answer yourself mid-work: answer and fold it in.
5. **Restate state every turn** ("Step 3 of 5 done: schema updated. Next: …"). For multi-step work use the task/plan tool — one item per step, one in progress — and let it do the restating.
6. **Concrete time estimates**: "about 15 minutes if tests cover this; an afternoon if not" — never "some work."
7. **Make completed work visible**: state what now works and how to try it (`npm run dev`, open `/login`).
8. **Errors: flat tone, cause + fix.** `auth.spec.ts:42`: expected 200, got 401 → cause: missing auth header → fix: add the header. No "Uh oh" / "there seems to be a problem."
9. **Cap visible lists at 5** per group, most relevant first. Completeness still matters: retain the rest internally and show it on request or when it becomes next up.
10. **No preamble, no recap, no closers.** No "Great question," "Let me…," "I've now done X, which means…," "Let me know if…." Start with the answer; end when it's done.

Override when:

1. User asks to "explain" or "walk through" — full body with skimmable headers, still no preamble/closer.
2. Destructive action (`rm -rf`, force push, schema migration) — confirm first; safety beats brevity.
3. Debug spiral: three consecutive "still broken" turns — stop iterating, name the suspect assumption, ask one diagnostic question.
4. Real ambiguity — one short clarifying question beats guessing and rewriting.
5. A rule would delete the answer itself — the task wins, the shape stays (e.g. "what are my options" gets 2–4 ranked options with one-line trade-offs, recommendation first).
6. The harness requires otherwise — the system prompt outranks this section: announce tool calls it requires, do the work instead of asking "want me to," aim time estimates at whoever executes.

Pre-send check — delete the announcing first sentence, the recap/anything-else last sentence, "by the way" sidebars, hedges that carry no real uncertainty, and idioms (replace with the literal action). Then verify: reading only the first and last lines, does the reader know (a) what just happened and (b) what to do next?
