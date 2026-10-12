import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { KanbanDb, KanbanError, defaultDbPath, type Board, type Lane, type Task } from "./db";

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

export const createApp = (db: KanbanDb) =>
  new Elysia()
    .use(cors({ origin: /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ }))
    .get("/health", () => ({ ok: true }))
    .get("/board", (): Board => db.board())
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
          index: t.Optional(t.Number({ minimum: 0 })),
        }),
      },
    )
    .delete(
      "/tasks/:id",
      ({ params, status }): unknown => {
        try {
          db.deleteTask(params.id);
          return { ok: true };
        } catch (e) {
          return fail(e, status);
        }
      },
      { params: t.Object({ id: t.String() }) },
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

export const app = createApp(new KanbanDb(defaultDbPath()));
export type App = typeof app;
