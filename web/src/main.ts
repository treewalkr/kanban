import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";

const target = document.getElementById("app")!;

// dev-only component gallery; the branch and its chunk are dropped from prod builds
if (import.meta.env.DEV && location.pathname === "/gallery") {
  const { default: Gallery } = await import("./gallery/Gallery.svelte");
  mount(Gallery, { target });
} else {
  mount(App, { target });
}
