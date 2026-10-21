import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { DEFAULT_LANES, KanbanDb, KanbanError } from "../src/db";

let dir = "";
let db: KanbanDb;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "kanban-db-"));
  db = new KanbanDb(join(dir, "t.db"));
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

test("seeds the default workflow lanes in order", () => {
  const lanes = db.lanes();
  expect(lanes.map((l) => l.id)).toEqual(DEFAULT_LANES.map((l) => l.id));
  expect(lanes.map((l) => l.position)).toEqual(DEFAULT_LANES.map((_, i) => (i + 1) * 100));
  expect(lanes.at(-1)?.id).toBe("archive");
  expect(lanes.at(-1)?.fixed).toBe(1);
});

test("appends the archive lane when reopening a board that predates it", () => {
  const path = join(dir, "old.db");
  new KanbanDb(path).close();
  const raw = new Database(path); // simulate a board written before archive existed
  raw.run("DELETE FROM lanes WHERE id = 'archive'");
  raw.close();
  const reopened = new KanbanDb(path);
  const lanes = reopened.lanes();
  expect(lanes.at(-1)?.id).toBe("archive");
  expect(lanes.at(-1)?.fixed).toBe(1);
  expect(lanes.at(-1)!.position).toBeGreaterThan(lanes.at(-2)!.position);
  reopened.close();
});

test("adds the parent column when reopening a board that predates hierarchy", () => {
  const path = join(dir, "old.db");
  const raw = new Database(path); // simulate a board written before parent_id existed
  raw.exec(`
    CREATE TABLE lanes (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      position REAL NOT NULL, fixed INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
      lane_id TEXT NOT NULL REFERENCES lanes (id), project TEXT NOT NULL DEFAULT '',
      position REAL NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    INSERT INTO lanes (id, name, description, position, fixed) VALUES ('todo', 'Todo', '', 100, 0);
    INSERT INTO tasks (id, title, note, lane_id, project, position, created_at, updated_at)
      VALUES ('abc12', 'legacy', '', 'todo', '', 100, 0, 0);
  `);
  raw.close();
  const reopened = new KanbanDb(path);
  expect(reopened.resolveTask("abc12").parentId).toBeNull();
  reopened.close();
});

test("createTask defaults to the first lane and appends in order", () => {
  const a = db.createTask({ title: "a" });
  const b = db.createTask({ title: "b" });
  expect(a.laneId).toBe("backlog");
  expect(a.position).toBe(100);
  expect(b.position).toBe(200);
  expect(db.laneTasks("backlog").map((t) => t.title)).toEqual(["a", "b"]);
});

test("resolves lanes by slug prefix, name prefix, and ordinal", () => {
  expect(db.resolveLane("imp").name).toBe("Test + Implement");
  expect(db.resolveLane("rev").name).toBe("Review");
  expect(db.resolveLane("3").name).toBe("Test + Implement");
  expect(() => db.resolveLane("zzz")).toThrow(KanbanError);
});

test("resolves tasks by id prefix and rejects ambiguity", () => {
  const a = db.createTask({ title: "a" });
  expect(db.resolveTask(a.id.slice(0, 2)).id).toBe(a.id);
  expect(() => db.resolveTask("zzzzz")).toThrow(/no task/);
});

test("moveTask inserts at an index and appends without one", () => {
  const a = db.createTask({ title: "a" });
  const b = db.createTask({ title: "b" });
  const c = db.createTask({ title: "c" });
  db.moveTask(c.id, "backlog", 0);
  expect(db.laneTasks("backlog").map((t) => t.title)).toEqual(["c", "a", "b"]);
  db.moveTask(c.id, "plan");
  expect(db.laneTasks("backlog").map((t) => t.title)).toEqual(["a", "b"]);
  expect(db.laneTasks("plan").map((t) => t.title)).toEqual(["c"]);
});

test("midpoint squeezes trigger renormalization instead of collapsing", () => {
  for (let i = 0; i < 40; i++) db.createTask({ title: `t${i}`, index: 0 });
  const positions = db.laneTasks("backlog").map((t) => t.position);
  for (let i = 1; i < positions.length; i++) {
    expect(positions[i] - positions[i - 1]).toBeGreaterThan(0.01);
  }
});

test("updateTask merges a patch and bumps updatedAt", () => {
  const a = db.createTask({ title: "old" });
  const updated = db.updateTask(a.id, { title: "new", note: "n", lane: "review", project: "x" });
  expect(updated.title).toBe("new");
  expect(updated.laneId).toBe("review");
  expect(updated.project).toBe("x");
  expect(updated.updatedAt).toBeGreaterThanOrEqual(a.createdAt);
});

test("lane guards: fixed lanes and non-empty lanes refuse deletion", () => {
  expect(() => db.deleteLane("backlog")).toThrow(/fixed/);
  db.createTask({ title: "a" });
  expect(() => db.deleteLane("backlog")).toThrow(/fixed/); // backlog is fixed even when full
  db.createTask({ title: "b", lane: "plan" });
  expect(() => db.deleteLane("plan")).toThrow(/still holds/);
  expect(db.deleteLane("plan", true).id).toBe("plan");
  expect(db.tasks().every((t) => t.laneId !== "plan")).toBe(true);
});

test("createLane slugifies and dedupes ids", () => {
  const first = db.createLane({ name: "Blocked" });
  const second = db.createLane({ name: "Blocked" });
  expect(first.id).toBe("blocked");
  expect(second.id).toBe("blocked-2");
});

test("board groups tasks by lane order", () => {
  db.createTask({ title: "a", lane: "done" });
  db.createTask({ title: "b" });
  const { tasks } = db.board();
  expect(tasks.map((t) => t.title)).toEqual(["b", "a"]);
});
