import { KanbanDb, type Task } from "./db";

/**
 * Auto-review loop, hosted by the serve process (`KANBAN_AUTO_REVIEW=1`).
 *
 * A card in the review lane whose thread's last comment is not from the
 * reviewer gets a headless `pi` review session; the session records its
 * verdict with the normal `kanban review` commands, which moves the card
 * (approve → done, block → implement + findings checklist). A block arms the
 * builder side: a card in implement whose last comment is a reviewer verdict
 * gets a `pi` builder session that works the findings and hands off to review
 * again. All state is derived from the board — nothing survives a restart,
 * and nothing needs to: a verdict comment disarms the card it answered.
 */

export const REVIEWER_AUTHOR = "pi-reviewer";
export const BUILDER_AUTHOR = "pi-builder";

export type AgentRole = "reviewer" | "builder";

export interface AgentJob {
  task: Task;
  role: AgentRole;
  prompt: string;
}

export interface SpawnContext {
  cwd: string;
  timeoutMs: number;
  log: (message: string) => void;
}

/** Runs one agent session; resolves with the child's exit code (non-zero = failure). */
export type SpawnFn = (job: AgentJob, ctx: SpawnContext) => Promise<number>;

export interface AutoReviewOptions {
  db: KanbanDb;
  cwd: string;
  spawnFn?: SpawnFn;
  timeoutMs?: number;
  maxBlocks?: number;
  watchIntervalMs?: number;
  log?: (message: string) => void;
}

const DEFAULT_TIMEOUT_MS = 20 * 60_000;
const DEFAULT_MAX_BLOCKS = 3;

export function reviewerPrompt(task: Task): string {
  return `You are pi-reviewer, an expert code reviewer. Kanban card ${task.id} "${task.title}" was just handed off to Review in this repo.

1. Run: kanban brief ${task.id} --json — the note, latest plan, and full thread (what the builder claims).
2. Locate the work: the last handoff message says what changed; use git log, git diff, and the files named in the plan.
3. Review like a senior engineer: correctness, edge cases, error handling, tests, adherence to the plan and repo conventions (read AGENTS.md if present).
4. Verify cheaply: run the test suite if it is fast (e.g. bun test).

Then record exactly one verdict (never move the card with mv):
- Pass: kanban review ${task.id} --approve --message "<1-3 sentence summary>" --author pi-reviewer
- Fail: kanban review ${task.id} --block --message "<summary>" --finding "<file:line — issue>" [--finding "<…>" …] --author pi-reviewer

If you cannot locate the work in this repo, do NOT block — post kanban comment ${task.id} "could not locate the work in this repo — needs manual review" --author pi-reviewer, and stop.
Your last line: a one-sentence verdict.`;
}

export function builderPrompt(task: Task): string {
  return `You are pi-builder. Kanban card ${task.id} "${task.title}" was blocked in review; its note now carries "- [ ]" findings from pi-reviewer.

1. Run: kanban brief ${task.id} — note (with the findings checklist), latest plan, full thread.
2. Fix every finding in this repo; run the tests.
3. Rewrite the note with the findings checked off: kanban edit ${task.id} --note "<full updated note with '- [x]' lines>".
4. Hand the card back: kanban handoff ${task.id} review --message "<what you fixed · test status>" --author pi-builder

Never move the card with mv. If a finding looks wrong, say so in the handoff message instead of silently skipping it.`;
}

const defaultSpawn: SpawnFn = (job, { cwd, timeoutMs, log }) => {
  const proc = Bun.spawn({
    cmd: ["pi", "--print", "--session-id", `kanban-${job.task.id}`, job.prompt],
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  // drain both pipes as they fill so a chatty child can't deadlock
  const stdout = new Response(proc.stdout).text();
  const stderr = new Response(proc.stderr).text();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, timeoutMs);
  timer.unref?.();
  return proc.exited.then(async (code) => {
    clearTimeout(timer);
    if (timedOut) log(`${job.role} ${job.task.id}: timed out after ${Math.round(timeoutMs / 60_000)} min, killed`);
    else if (code !== 0) {
      const tail = ((await stderr) || (await stdout)).trim();
      if (tail) log(`${job.role} ${job.task.id}: exited ${code}, output tail:\n${tail.slice(-1500)}`);
    }
    return timedOut ? 1 : (code ?? 1);
  });
};

export function startAutoReview(opts: AutoReviewOptions): { stop(): void } {
  const db = opts.db;
  const log = opts.log ?? (() => {});
  const spawnFn = opts.spawnFn ?? defaultSpawn;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBlocks = opts.maxBlocks ?? DEFAULT_MAX_BLOCKS;

  const queue: AgentJob[] = [];
  const inFlight = new Set<string>();
  let draining = false;
  let stopped = false;

  /** What the card needs right now: a reviewer, a builder, or nothing. */
  const roleFor = (task: Task): AgentRole | "capped" | null => {
    const thread = db.comments(task.id);
    const last = thread.at(-1);
    if (task.laneId === "review" && last?.author !== REVIEWER_AUTHOR) return "reviewer";
    if (task.laneId === "implement" && last?.kind === "review" && last?.author === REVIEWER_AUTHOR) {
      const blocks = thread.filter((c) => c.kind === "review" && c.author === REVIEWER_AUTHOR).length;
      return blocks < maxBlocks ? "builder" : "capped";
    }
    return null;
  };

  const enqueue = (job: AgentJob): void => {
    if (stopped || inFlight.has(job.task.id) || queue.some((j) => j.task.id === job.task.id)) return;
    queue.push(job);
  };

  function scan(): void {
    if (stopped) return;
    const lanes = new Set(db.lanes().map((l) => l.id));
    if (!lanes.has("review") || !lanes.has("implement")) return;
    for (const task of db.tasks()) {
      const role = roleFor(task);
      if (role === "reviewer") enqueue({ task, role, prompt: reviewerPrompt(task) });
      else if (role === "builder") enqueue({ task, role, prompt: builderPrompt(task) });
      else if (role === "capped") {
        // posting flips the last comment away from the verdict, so this fires once
        db.createComment(task.id, {
          author: REVIEWER_AUTHOR,
          kind: "comment",
          body: `auto-review stopped: block cycles reached the cap of ${maxBlocks} — needs a human. Findings are on the note.`,
        });
        log(`cap reached on ${task.id} — leaving it for a human`);
      }
    }
    void drain();
  }

  async function drain(): Promise<void> {
    if (draining) return;
    draining = true;
    try {
      while (!stopped && queue.length > 0) {
        const job = queue.shift()!;
        const fresh = db.tasks().find((t) => t.id === job.task.id);
        if (!fresh || roleFor(fresh) !== job.role) continue; // state moved on while queued
        inFlight.add(job.task.id);
        log(`${job.role} start ${job.task.id} "${job.task.title}"`);
        let code = 0;
        try {
          code = await spawnFn(job, { cwd: opts.cwd, timeoutMs, log });
        } catch (err) {
          log(`${job.role} ${job.task.id}: spawn error ${(err as Error).message}`);
          code = 1;
        }
        inFlight.delete(job.task.id);
        try {
          afterJob(job, code);
        } catch (err) {
          log(`${job.role} ${job.task.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
        scan(); // follow the verdict: block → builder, handoff → reviewer
      }
    } finally {
      draining = false;
    }
  }

  /** Log the outcome; if the session died without leaving a trace, say so on the card. */
  function afterJob(job: AgentJob, code: number): void {
    const task = db.tasks().find((t) => t.id === job.task.id);
    if (!task) return;
    const last = db.comments(task.id).at(-1);
    if (job.role === "reviewer") {
      if (task.laneId === "done") log(`reviewer ${task.id}: approved → done`);
      else if (task.laneId === "implement") log(`reviewer ${task.id}: blocked → implement`);
      else if (last?.author === REVIEWER_AUTHOR) log(`reviewer ${task.id}: left a comment, no verdict`);
      else {
        db.createComment(task.id, {
          author: REVIEWER_AUTHOR,
          kind: "comment",
          body: `auto-review ${code !== 0 ? `failed (exit ${code})` : "ended without a verdict"} — comment on this card to re-trigger.`,
        });
      }
    } else {
      if (task.laneId === "review") log(`builder ${task.id}: fixed → back to review`);
      else if (last?.author === BUILDER_AUTHOR) log(`builder ${task.id}: left a comment, no handoff`);
      else {
        db.createComment(task.id, {
          author: BUILDER_AUTHOR,
          kind: "comment",
          body: `auto-builder ${code !== 0 ? `failed (exit ${code})` : "ended without a handoff"} — findings unaddressed, needs a human.`,
        });
      }
    }
  }

  const stopWatch = db.watch(() => scan(), opts.watchIntervalMs ?? 300);
  log(`enabled — agents run in ${opts.cwd}, timeout ${Math.round(timeoutMs / 60_000)} min, block cap ${maxBlocks}`);
  scan(); // cards already waiting get picked up right away

  return {
    stop(): void {
      stopped = true;
      stopWatch();
      queue.length = 0;
    },
  };
}
