---
name: kanban
description: Track and manage task state on the Kanban board (Backlog → Plan → Test + Implement → Review → Done) using the kanban CLI. Use when starting, planning, or finishing a unit of work; when the user mentions tasks, the board, kanban, backlog, "what's next", or moving work forward; and to review what's in flight.
---

# Kanban board

One global task board stored in SQLite, shared by the `kanban` CLI and a web UI
(`kanban serve --open` → http://127.0.0.1:4600). The CLI writes the database
directly — the web server does **not** need to be running.

## Workflow contract

Keep the board truthful as you work. Lanes and their meaning, in order:

1. **Backlog** — captured but not started
2. **Plan** — scoping/design before code
3. **Test + Implement** — actively building (test as you go)
4. **Review** — code done, verifying / awaiting user acceptance
5. **Done** — finished

For every non-trivial unit of work:

- **Before starting**: ensure a card exists and sits in the lane matching what
  you're about to do (`add` → `mv plan` when planning, `mv implement` when coding).
- **As you progress**: advance the card (`mv implement`, then `mv review` when
  the work looks complete).
- **After acceptance**: `mv done` (or `done <id>`).
- **If work is abandoned or superseded**: delete the card (`rm`). Never leave
  stale cards behind — the board must reflect reality.

## Commands

```
kanban add <title…> [--note <text>] [--lane <ref>] [--project <tag>]   # new card (Backlog by default)
kanban ls [lane] [--project <tag>] [--json]                           # board overview / one lane
kanban show <id>                                                      # full detail incl. note
kanban mv <id> <lane> [--pos <1-based>]                               # move / reorder
kanban mv <id> --next | --prev                                        # advance / pull back one lane
kanban edit <id> [--title <t>] [--note <text>] [--project <tag>] [--clear-note]
kanban done <id>                                                      # shortcut → Done
kanban rm <id>                                                        # delete card
kanban lane ls | add <name> | rename <ref> <name> | rm <ref>          # manage lanes
kanban serve [--open]                                                 # start web UI at 127.0.0.1:4600
```

## Conventions

- **Task ids**: any unique prefix works (`kanban show k7x`). Use full ids in
  scripts, prefixes interactively.
- **Lane refs**: slug (`backlog`), unique prefix (`imp`), name prefix (`Rev`),
  or ordinal (`1`–`n` in board order).
- **`--project`**: tag cards with the repo name (`--project kanban`) so the
  board stays scannable across projects; filter with `kanban ls --project X`
  or the chips in the web UI.
- **`--json`**: append to any command for machine-readable output; on error the
  CLI exits 1 and prints `kanban: <message>` to stderr.
- The web UI edits the same database and polls every few seconds, so CLI and
  browser changes stay in sync automatically.
- First run of a command creates `data/kanban.db` in the app repo and seeds the
  five default lanes (Backlog / Plan / Test + Implement / Review / Done). Lanes
  are customizable — `lane add`/`rename`/`rm` — but keep `backlog` and `done`
  at the ends; they are fixed.

## When the user asks "what's next" / to plan the day

Run `kanban ls` (or `--json`), read Review first (awaiting acceptance), then
Test + Implement (in flight), then Plan, then Backlog. Summarize per lane and
propose the next card to pull forward.
