import { treaty } from "@elysiajs/eden";
import type { App } from "../../src/app";

// Dev: page on :5174, api on :4600 (CORS enabled). Prod: served same-origin by the api.
export const api = treaty<App>(import.meta.env.DEV ? "http://localhost:4600" : window.location.origin);

// SSE change stream; EventSource is a browser streaming client, not a REST call
export const eventsUrl = import.meta.env.DEV ? "http://localhost:4600/events" : "/events";
