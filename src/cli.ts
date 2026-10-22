#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KanbanDb, KanbanError, defaultDbPath, type Task, type TaskPatch } from "./db";
import { c, commentLine, commentThread, laneList, listLanes, searchResults, taskDetail, taskLine } from "./render";
import { searchBoard } from "./search";

const VERSION = "0.3.0";

const HELP = `kanban ${VERSION} — task board for the pi agent

usage:
  kanban add <title…> [--note <text>] [--lane <ref>] [--project <tag>] [--parent <id>] [--top]
  kanban ls [lane] [--project <tag>] [--json]
  kanban search <query…> [--project <tag>] [--json]
  kanban show <id>
  kanban attach <id> <plan-file>            (re-attach versions; show prints the latest)
  kanban comment <id> <text…> [--author <name>] [--kind <comment|review|handoff>]
  kanban comments <id>
  kanban mv <id> <lane> [--pos <1-based>]     kanban mv <id> --next | --prev
  kanban edit <id> [--title <t>] [--note <text>] [--project <tag>] [--lane <ref>]
                          [--parent <id>] [--clear-note] [--clear-parent]
  kanban done <id>
  kanban archive <id>                        (undo: mv <id> <lane>)
  kanban rm <id> [--force]                   (deleting a parent needs --force)
  kanban lane ls | add <name> | rename <ref> <name> | rm <ref> [--force]
  kanban serve [--port <n>] [--open]
  kanban help | version

lane refs: slug (backlog), prefix (imp), name prefix (Rev), or ordinal (1..n)
task ids: any unique prefix works. add --json for machine-readable output.
search: ranks titles, checklist lines, note text, then plans — same results as the web dropdown.
hierarchy: --parent nests a card (epic → story → subtask, max depth 3).`;

interface Parsed {
  flags: Record<string, string | true>;
  positional: string[];
}

const VALUE_FLAGS = new Set(["note", "lane", "project", "pos", "title", "port", "parent", "author", "kind"]);
const BOOL_FLAGS = new Set(["json", "force", "next", "prev", "open", "top", "clear-note", "clear-parent"]);

function parse(argv: string[]): Parsed {
  const flags: Record<string, string | true> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith("--")) {
      const key = a.slice(2);
      if (BOOL_FLAGS.has(key)) flags[key] = true;
      else if (VALUE_FLAGS.has(key)) flags[key] = argv[++i] ?? "";
      else throw new KanbanError(`unknown flag '${a}' (see: kanban help)`, "invalid");
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

const str = (flags: Parsed["flags"], key: string): string | undefined => {
  const v = flags[key];
  return typeof v === "string" ? v : undefined;
};

function jsonOut(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

/** Relative lane for --next / --prev. */
function stepLane(db: KanbanDb, task: Task, delta: number): string {
  const lanes = db.lanes();
  const i = lanes.findIndex((l) => l.id === task.laneId);
  const next = i + delta;
  if (next < 0 || next >= lanes.length) {
    throw new KanbanError(delta < 0 ? "already in the first lane" : "already in the last lane", "conflict");
  }
  return lanes[next].id;
}

/** Fixed target lane for done/archive — no silent fallback to another lane. */
function laneById(db: KanbanDb, id: string): string {
  const lane = db.lanes().find((l) => l.id === id);
  if (!lane) throw new KanbanError(`no '${id}' lane on this board`, "not-found");
  return lane.id;
}

async function main(): Promise<number> {
  const argv = Bun.argv.slice(2);
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(HELP);
    return 0;
  }
  if (cmd === "version" || cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return 0;
  }

  if (cmd === "serve") {
    const { flags } = parse(rest);
    const port = Number(str(flags, "port") ?? process.env.PORT ?? 4600);
    if (flags.open) setTimeout(() => Bun.spawn(["open", `http://127.0.0.1:${port}`]), 800);
    const proc = Bun.spawn({
      cmd: [process.execPath, join(import.meta.dir, "index.ts")],
      env: { ...process.env, PORT: String(port) },
      stdio: ["inherit", "inherit", "inherit"],
    });
    await proc.exited;
    return proc.exitCode ?? 0;
  }

  const db = new KanbanDb(defaultDbPath());
  try {
    const { flags, positional } = parse(rest);
    const json = !!flags.json;
    const project = str(flags, "project");

    switch (cmd) {
      case "add": {
        const title = positional.join(" ");
        if (!title) throw new KanbanError("usage: kanban add <title…>", "invalid");
        const task = db.createTask({
          title,
          note: str(flags, "note"),
          lane: str(flags, "lane"),
          project,
          parent: str(flags, "parent"),
          index: flags.top ? 0 : (str(flags, "pos") ? Number(str(flags, "pos")) - 1 : undefined),
        });
        if (json) jsonOut(task);
        else console.log(taskLine(db, task));
        return 0;
      }

      case "ls": {
        const laneRef = positional[0];
        if (laneRef) db.resolveLane(laneRef); // validate before filtering
        const tasks = db
          .tasks()
          .filter((t) => (laneRef ? t.laneId === db.resolveLane(laneRef).id : true))
          .filter((t) => (project ? t.project === project : true));
        if (json) jsonOut(tasks);
        else console.log(listLanes(db, laneRef, project));
        return 0;
      }

      case "search": {
        const query = positional.join(" ").trim();
        if (!query) throw new KanbanError("usage: kanban search <query…> [--project <tag>]", "invalid");
        const results = searchBoard(
          db.tasks().filter((t) => (project ? t.project === project : true)),
          query,
          db.latestPlans(),
        );
        if (json) jsonOut(results);
        else console.log(searchResults(db, query, results));
        return 0;
      }

      case "show": {
        const task = db.resolveTask(positional[0] ?? "");
        if (json) jsonOut(task);
        else console.log(taskDetail(db, task));
        return 0;
      }

      case "attach": {
        const [idRef, file] = positional;
        if (!idRef || !file) throw new KanbanError("usage: kanban attach <id> <plan-file>", "invalid");
        let content: string;
        try {
          content = readFileSync(file, "utf8");
        } catch (err) {
          throw new KanbanError(`cannot read plan file '${file}': ${(err as Error).message}`, "invalid");
        }
        const plan = db.attach(idRef, "plan", content, file);
        if (json) jsonOut(plan);
        else console.log(`${c.green("✓")} attached plan ${c.dim(`v${plan.version}`)} to ${c.dim(plan.taskId)}`);
        return 0;
      }

      case "comment": {
        const [idRef, ...text] = positional;
        const body = text.join(" ");
        if (!idRef || !body) {
          throw new KanbanError("usage: kanban comment <id> <text…> [--author <name>] [--kind <comment|review|handoff>]", "invalid");
        }
        const comment = db.createComment(idRef, { body, author: str(flags, "author"), kind: str(flags, "kind") });
        if (json) jsonOut(comment);
        else console.log(commentLine(comment));
        return 0;
      }

      case "comments": {
        const idRef = positional[0];
        if (!idRef) throw new KanbanError("usage: kanban comments <id>", "invalid");
        const comments = db.comments(idRef);
        if (json) jsonOut(comments);
        else console.log(commentThread(comments));
        return 0;
      }

      case "mv": {
        const task = db.resolveTask(positional[0] ?? "");
        let laneRef = positional[1];
        if (flags.next) laneRef = stepLane(db, task, 1);
        else if (flags.prev) laneRef = stepLane(db, task, -1);
        if (!laneRef) throw new KanbanError("usage: kanban mv <id> <lane | --next | --prev>", "invalid");
        const pos = str(flags, "pos");
        const moved = db.moveTask(task.id, laneRef, pos ? Number(pos) - 1 : undefined);
        if (json) jsonOut(moved);
        else console.log(taskLine(db, moved));
        return 0;
      }

      case "edit": {
        const id = positional[0] ?? "";
        const patch: TaskPatch = {};
        if (str(flags, "title") !== undefined) patch.title = str(flags, "title");
        if (str(flags, "note") !== undefined) patch.note = str(flags, "note");
        if (flags["clear-note"]) patch.note = "";
        if (project !== undefined) patch.project = project;
        if (str(flags, "lane") !== undefined) patch.lane = str(flags, "lane");
        if (str(flags, "parent") !== undefined) patch.parent = str(flags, "parent");
        if (flags["clear-parent"]) patch.parent = null;
        if (Object.keys(patch).length === 0) {
          throw new KanbanError(
            "nothing to edit — pass --title, --note, --project, --lane, --parent or --clear-note/--clear-parent",
            "invalid",
          );
        }
        const updated = db.updateTask(id, patch);
        if (json) jsonOut(updated);
        else console.log(taskLine(db, updated));
        return 0;
      }

      case "done": {
        const task = db.resolveTask(positional[0] ?? "");
        const moved = db.moveTask(task.id, laneById(db, "done"));
        if (json) jsonOut(moved);
        else console.log(taskLine(db, moved));
        return 0;
      }

      case "archive": {
        const task = db.resolveTask(positional[0] ?? "");
        const moved = db.moveTask(task.id, laneById(db, "archive"));
        if (json) jsonOut(moved);
        else console.log(taskLine(db, moved));
        return 0;
      }

      case "rm": {
        const task = db.deleteTask(positional[0] ?? "", !!flags.force);
        if (json) jsonOut({ ok: true, removed: task });
        else console.log(`removed  ${task.id}  ${task.title}`);
        return 0;
      }

      case "lane": {
        const [sub, ...subRest] = positional;
        switch (sub) {
          case undefined:
          case "ls": {
            if (json) jsonOut(db.lanes());
            else console.log(laneList(db));
            return 0;
          }
          case "add": {
            const name = subRest.join(" ");
            if (!name) throw new KanbanError("usage: kanban lane add <name>", "invalid");
            const lane = db.createLane({ name });
            if (json) jsonOut(lane);
            else console.log(`${lane.id}  ${lane.name}  added`);
            return 0;
          }
          case "rename": {
            const ref = subRest[0] ?? "";
            const name = subRest.slice(1).join(" ");
            if (!ref || !name) throw new KanbanError("usage: kanban lane rename <ref> <name>", "invalid");
            const lane = db.updateLane(ref, { name });
            if (json) jsonOut(lane);
            else console.log(`${lane.id}  ${lane.name}  renamed`);
            return 0;
          }
          case "rm": {
            const lane = db.deleteLane(subRest[0] ?? "", !!flags.force);
            if (json) jsonOut({ ok: true, removed: lane });
            else console.log(`${lane.id}  removed`);
            return 0;
          }
          default:
            throw new KanbanError(`unknown lane subcommand '${sub}' (ls | add | rename | rm)`, "invalid");
        }
      }

      default:
        throw new KanbanError(`unknown command '${cmd}' (see: kanban help)`, "invalid");
    }
  } finally {
    db.close();
  }
}

try {
  process.exitCode = await main();
} catch (err) {
  const msg = err instanceof KanbanError ? err.message : (err as Error)?.message ?? String(err);
  console.error(`kanban: ${msg}`);
  process.exitCode = 1;
}
