import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { KanbanDb, KanbanError, defaultDbPath, type Board, type Lane, type Task } from "./db";

const errorStatus = { "not-found": 404, conflict: 409, invalid: 400 } as const;

export const createApp = (db: KanbanDb) =>
  new Elysia()
    .use(cors({ origin: /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ }))
    .onError(({ error, set }) => {
      if (error instanceof KanbanError) {
        set.status = errorStatus[error.code];
        return { error: error.message, code: error.code };
      }
    })
    .get("/health", () => ({ ok: true }))
    .get("/board", (): Board => db.board())
    .post(
      "/tasks",
      ({ body, set }): Task => {
        set.status = 201;
        return db.createTask(body);
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
      ({ params, body }): Task => db.updateTask(params.id, body),
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
      ({ params }) => {
        db.deleteTask(params.id);
        return { ok: true };
      },
      { params: t.Object({ id: t.String() }) },
    )
    .post(
      "/lanes",
      ({ body, set }): Lane => {
        set.status = 201;
        return db.createLane(body);
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
      ({ params, body }): Lane => db.updateLane(params.id, body),
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
      ({ params, query }) => {
        return db.deleteLane(params.id, query.force === "true");
      },
      {
        params: t.Object({ id: t.String() }),
        query: t.Object({ force: t.Optional(t.String()) }),
      },
    );

export const app = createApp(new KanbanDb(defaultDbPath()));
export type App = typeof app;
