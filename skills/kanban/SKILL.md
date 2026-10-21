---
name: kanban
description: Track and manage task state on the Kanban board (Backlog → Plan → Test + Implement → Review → Done → Archive) using the kanban CLI. Use when starting, planning, or finishing a unit of work; when the user mentions tasks, the board, kanban, backlog, "what's next", or moving work forward; and to review what's in flight.
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
6. **Archive** — kept for reference, out of the active board

For every non-trivial unit of work:

- **Before starting**: ensure a card exists and sits in the lane matching what
  you're about to do (`add` → `mv plan` when planning, `mv implement` when coding).
- **As you progress**: advance the card (`mv implement`, then `mv review` when
  the work looks complete).
- **After acceptance**: `mv done` (or `done <id>`).
- **When a finished card is worth keeping but Done is getting crowded**:
  `archive <id>`. Undo with `mv <id> <lane>`.
- **If work is abandoned or superseded**: delete the card (`rm`). Never leave
  stale cards behind — the board must reflect reality.

## Commands

```
kanban add <title…> [--note <text>] [--lane <ref>] [--project <tag>] [--parent <id>] [--top]  # new card (Backlog by default; --parent nests it)
kanban ls [lane] [--project <tag>] [--json]                           # board overview / one lane (children indented)
kanban search <query…> [--project <tag>] [--json]                     # ranked matches: titles, checklist lines, notes
kanban show <id>                                                      # full detail incl. note, parent, subtasks
kanban mv <id> <lane> [--pos <1-based>]                               # move / reorder
kanban mv <id> --next | --prev                                        # advance / pull back one lane
kanban edit <id> [--title <t>] [--note <text>] [--project <tag>] [--lane <ref>] [--parent <id>] [--clear-note] [--clear-parent]
kanban done <id>                                                      # shortcut → Done
kanban archive <id>                                                   # shortcut → Archive (undo: mv <id> <lane>)
kanban rm <id> [--force]                                              # delete card (a parent needs --force; cascades)
kanban lane ls | add <name> | rename <ref> <name> | rm <ref> [--force]  # manage lanes
kanban serve [--port <n>] [--open]                                    # start web UI (default 127.0.0.1:4600)
kanban help | version                                                 # CLI help / version
```

## Conventions

- **Task ids**: any unique prefix works (`kanban show k7x`). Use full ids in
  scripts, prefixes interactively.
- **Lane refs**: slug (`backlog`), unique prefix (`imp`), name prefix (`Rev`),
  or ordinal (`1`–`n` in board order).
- **`--project`**: tag cards with the repo name (`--project kanban`) so the
  board stays scannable across projects; filter with `kanban ls --project X`
  or the chips in the web UI.
- **`--parent`**: nest a card under another (epic → story → subtask, max depth
  3). `add --parent <id>` defaults the child to the parent's lane;
  `edit --parent <id>` reparents, `edit --clear-parent` detaches. Each card
  still moves through lanes **independently** — finishing a parent never
  auto-finishes children, so advance subtasks as you complete them (`done` on
  each). `rm` on a parent with children refuses without `--force`, which
  deletes the whole subtree. The web UI nests same-lane children under the
  parent card with a `2/3 ✓` progress badge; `show <id>` prints the tree.
- **`--note`**: free text, rendered as GitHub-flavored markdown in the web UI —
  handy for acceptance-criteria checklists (`- [ ] …`), tables, code snippets,
  links. For multi-line notes from a shell, pass the text through a quoted
  heredoc so backticks and quotes survive:
  `n=$(cat <<'EOF' … EOF); kanban edit <id> --note "$n"`.
- **`lane rm --force`** deletes the lane *and every card in it* — it does not
  relocate them. Move cards out first unless you mean to drop them.
- **`--json`**: append to any command for machine-readable output; on error the
  CLI exits 1 and prints `kanban: <message>` to stderr.
- The web UI edits the same database and receives pushed updates (SSE), so
  CLI and browser changes stay in sync automatically. Clicking a card opens a
  detail view (full note, timestamps, quick done/archive actions) with an edit
  mode.
  Archive shows as a collapsed strip at the end of the board — click to expand,
  or drag a card onto it to archive.
- First run of a command creates `data/kanban.db` in the app repo and seeds the
  six default lanes (Backlog / Plan / Test + Implement / Review / Done /
  Archive). Lanes are customizable — `lane add`/`rename`/`rm` — but keep
  `backlog` and `done` at the ends; they are fixed, as is `archive`.

## When the user asks "what's next" / to plan the day

Run `kanban ls` (or `--json`), read Review first (awaiting acceptance), then
Test + Implement (in flight), then Plan, then Backlog. Skip Archive — it's
history, not work. Summarize per lane and propose the next card to pull
forward.
