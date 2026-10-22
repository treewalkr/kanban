import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app";
import { KanbanDb } from "../src/db";

let dir = "";
let db: KanbanDb;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "kanban-api-"));
  db = new KanbanDb(join(dir, "t.db"));
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

test("/events streams an initial sync, then a change on API mutations", async () => {
  const app = createApp(db);
  const task = db.createTask({ title: "one" });

  const res = await app.handle(new Request("http://localhost/events"));
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("text/event-stream");

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const readChunk = async () => decoder.decode((await reader.read()).value);

  expect(await readChunk()).toContain("event: change"); // fresh subscriber syncs immediately

  await app.handle(
    new Request(`http://localhost/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "renamed" }),
    }),
  );
  expect(await readChunk()).toContain("event: change");

  await reader.cancel(); // client disconnect unsubscribes without throwing
});

test("POST /tasks/:id/plan stores a version; GET returns the latest or 404", async () => {
  const app = createApp(db);
  const task = db.createTask({ title: "one" });

  const missing = await app.handle(new Request(`http://localhost/tasks/${task.id}/plan`));
  expect(missing.status).toBe(404);

  const post = await app.handle(
    new Request(`http://localhost/tasks/${task.id}/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "draft 1", source: "/tmp/p.md" }),
    }),
  );
  expect(post.status).toBe(201);
  expect(await post.json()).toMatchObject({ version: 1, content: "draft 1", source: "/tmp/p.md" });

  await app.handle(
    new Request(`http://localhost/tasks/${task.id}/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "draft 2" }),
    }),
  );
  const got = await app.handle(new Request(`http://localhost/tasks/${task.id}/plan`));
  expect(got.status).toBe(200);
  expect(await got.json()).toMatchObject({ version: 2, content: "draft 2", source: "" });

  const noTask = await app.handle(new Request("http://localhost/tasks/zzzzz/plan"));
  expect(noTask.status).toBe(404);
});

test("/board carries the latest plan per card", async () => {
  const app = createApp(db);
  const task = db.createTask({ title: "one" });
  db.attach(task.id, "plan", "v1");
  db.attach(task.id, "plan", "v2");

  const res = await app.handle(new Request("http://localhost/board"));
  const board = (await res.json()) as { plans: Record<string, { content: string; version: number }> };
  expect(board.plans[task.id]).toMatchObject({ content: "v2", version: 2 });
});

test("GET/POST /tasks/:id/comments thread a card; unknown task 404s, bad body 4xx", async () => {
  const app = createApp(db);
  const task = db.createTask({ title: "one" });

  const empty = await app.handle(new Request(`http://localhost/tasks/${task.id}/comments`));
  expect(empty.status).toBe(200);
  expect(await empty.json()).toEqual([]);

  const post = await app.handle(
    new Request(`http://localhost/tasks/${task.id}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "picked this up", author: "pi-builder" }),
    }),
  );
  expect(post.status).toBe(201);
  expect(await post.json()).toMatchObject({ author: "pi-builder", kind: "comment", body: "picked this up" });

  const got = await app.handle(new Request(`http://localhost/tasks/${task.id}/comments`));
  expect(await got.json()).toHaveLength(1);

  const noTask = await app.handle(new Request("http://localhost/tasks/zzzzz/comments"));
  expect(noTask.status).toBe(404);

  const blank = await app.handle(
    new Request(`http://localhost/tasks/${task.id}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "" }),
    }),
  );
  expect(blank.status).toBe(422);

  const badKind = await app.handle(
    new Request(`http://localhost/tasks/${task.id}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "x", kind: "shout" }),
    }),
  );
  expect(badKind.status).toBe(422);
});
