import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { KanbanDb, KanbanError, defaultDbPath, type Attachment, type Board, type Comment, type Lane, type Task } from "./db";

const errorStatus = { "not-found": 404, conflict: 409, invalid: 400 } as const;

/**
 * Map KanbanError to a typed `status()` response (treaty moves it to `error.value`);
 * anything else is a real bug and rethrows.
 */
function fail(e: unknown, status: (code: number, value: unknown) => unknown): unknown {
  if (e instanceof KanbanError) {
    return status(errorStatus[e.code], { error: e.message, code: e.code });
  }
  throw e;
}

/** Coalescing change bus feeding /events: bursts of writes become one notification. */
function createChangeBus() {
  const subs = new Set<() => void>();
  let scheduled: ReturnType<typeof setTimeout> | null = null;
  return {
    subscribe(cb: () => void): () => void {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    emit(): void {
      if (scheduled) return;
      scheduled = setTimeout(() => {
        scheduled = null;
        for (const cb of subs) cb();
      }, 100);
    },
  };
}

export const createApp = (db: KanbanDb) => {
  const bus = createChangeBus();
  db.watch(() => bus.emit()); // CLI writes commit from another connection
  return new Elysia()
    .use(cors({ origin: /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ }))
    .onAfterHandle(({ request }) => {
      // API writes share the watched connection, so data_version won't see them
      if (request.method !== "GET") bus.emit();
    })
    .get("/events", ({ request }) => {
      const encoder = new TextEncoder();
      let closed = false;
      let unsubscribe: (() => void) | null = null;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      const close = () => {
        if (closed) return;
        closed = true;
        unsubscribe?.();
        if (heartbeat) clearInterval(heartbeat);
        request.signal.removeEventListener("abort", close);
      };
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            const send = (data: string) => {
              try {
                controller.enqueue(encoder.encode(data));
              } catch {
                close(); // stream already gone (client disconnected)
              }
            };
            send("event: change\ndata: {}\n\n"); // a fresh subscriber syncs right away
            unsubscribe = bus.subscribe(() => send("event: change\ndata: {}\n\n"));
            heartbeat = setInterval(() => send(": ping\n\n"), 30_000);
            heartbeat.unref();
            request.signal.addEventListener("abort", close);
          },
          cancel() {
            close();
          },
        }),
        { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } },
      );
    })
    .get("/health", () => ({ ok: true }))
    .get("/board", (): Board => db.board())
    .post(
      "/tasks/:id/plan",
      ({ params, body, status }): Attachment | unknown => {
        try {
          return status(201, db.attach(params.id, "plan", body.content, body.source));
        } catch (e) {
          return fail(e, status);
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          content: t.String({ minLength: 1 }),
          source: t.Optional(t.String()),
        }),
      },
    )
    .get(
      "/tasks/:id/plan",
      ({ params, status }): Attachment | unknown => {
        try {
          const plan = db.latestPlan(params.id);
          if (!plan) throw new KanbanError(`no plan on task '${params.id}'`, "not-found");
          return plan;
        } catch (e) {
          return fail(e, status);
        }
      },
      { params: t.Object({ id: t.String() }) },
    )
    .get(
      "/tasks/:id/comments",
      ({ params, status }): Comment[] | unknown => {
        try {
          return db.comments(params.id);
        } catch (e) {
          return fail(e, status);
        }
      },
      { params: t.Object({ id: t.String() }) },
    )
    .post(
      "/tasks/:id/comments",
      ({ params, body, status }): Comment | unknown => {
        try {
          return status(201, db.createComment(params.id, body));
        } catch (e) {
          return fail(e, status);
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          body: t.String({ minLength: 1 }),
          author: t.Optional(t.String()),
          kind: t.Optional(
            t.Union([t.Literal("comment"), t.Literal("review"), t.Literal("handoff")]),
          ),
        }),
      },
    )
    .post(
      "/tasks",
      ({ body, status }): Task | unknown => {
        try {
          return status(201, db.createTask(body));
        } catch (e) {
          return fail(e, status);
        }
      },
      {
        body: t.Object({
          title: t.String({ minLength: 1 }),
          note: t.Optional(t.String()),
          lane: t.Optional(t.String()),
          project: t.Optional(t.String()),
          parent: t.Optional(t.Nullable(t.String())),
          index: t.Optional(t.Number({ minimum: 0 })),
        }),
      },
    )
    .patch(
      "/tasks/:id",
      ({ params, body, status }): Task | unknown => {
        try {
          return db.updateTask(params.id, body);
        } catch (e) {
          return fail(e, status);
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          title: t.Optional(t.String()),
          note: t.Optional(t.String()),
          project: t.Optional(t.String()),
          lane: t.Optional(t.String()),
          parent: t.Optional(t.Nullable(t.String())),
          index: t.Optional(t.Number({ minimum: 0 })),
        }),
      },
    )
    .delete(
      "/tasks/:id",
      ({ params, query, status }): unknown => {
        try {
          db.deleteTask(params.id, query.force === "true");
          return { ok: true };
        } catch (e) {
          return fail(e, status);
        }
      },
      {
        params: t.Object({ id: t.String() }),
        query: t.Object({ force: t.Optional(t.String()) }),
      },
    )
    .post(
      "/lanes",
      ({ body, status }): Lane | unknown => {
        try {
          return status(201, db.createLane(body));
        } catch (e) {
          return fail(e, status);
        }
      },
      {
        body: t.Object({
          name: t.String({ minLength: 1 }),
          description: t.Optional(t.String()),
          index: t.Optional(t.Number({ minimum: 0 })),
        }),
      },
    )
    .patch(
      "/lanes/:id",
      ({ params, body, status }): Lane | unknown => {
        try {
          return db.updateLane(params.id, body);
        } catch (e) {
          return fail(e, status);
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          description: t.Optional(t.String()),
          index: t.Optional(t.Number({ minimum: 0 })),
        }),
      },
    )
    .delete(
      "/lanes/:id",
      ({ params, query, status }): unknown => {
        try {
          return db.deleteLane(params.id, query.force === "true");
        } catch (e) {
          return fail(e, status);
        }
      },
      {
        params: t.Object({ id: t.String() }),
        query: t.Object({ force: t.Optional(t.String()) }),
      },
    );
};

export const app = createApp(new KanbanDb(defaultDbPath()));
export type App = typeof app;
