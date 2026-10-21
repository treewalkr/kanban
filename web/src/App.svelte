<script lang="ts">
  import { board } from "./lib/board.svelte";
  import { eventsUrl } from "./api";
  import LaneView from "./lib/Lane.svelte";
  import TaskDetail from "./lib/TaskDetail.svelte";
  import TaskEditor from "./lib/TaskEditor.svelte";
  import AddLane from "./lib/AddLane.svelte";

  let theme = $state(document.documentElement.dataset.theme === "light" ? "light" : "dark");

  function toggleTheme() {
    theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("kanban-theme", theme);
  }

  // initial load, plus catch-up when a modal closes (change events are paused while editing)
  $effect(() => {
    if (!board.editing) board.refresh();
  });

  // keep the board in sync with CLI-side and other-tab writes, pushed over SSE
  $effect(() => {
    const source = new EventSource(eventsUrl);
    const refresh = () => {
      if (!document.hidden && !board.editing) board.refresh();
    };
    let opened = false;
    source.addEventListener("change", refresh);
    source.addEventListener("open", () => {
      // the server's initial sync event covers the first connect; catch up on reconnects
      if (opened) refresh();
      opened = true;
    });
    document.addEventListener("visibilitychange", refresh);
    return () => {
      source.close();
      document.removeEventListener("visibilitychange", refresh);
    };
  });
</script>

<div class="app">
  <header class="top">
    <div class="brand"><span class="mark"></span>kanban</div>
    <input class="search" type="search" placeholder="search…" bind:value={board.search} />
    <div class="chips">
      <button class:active={board.projectFilter === ""} onclick={() => (board.projectFilter = "")}>
        all
      </button>
      {#each board.projects as p (p)}
        <button
          class:active={board.projectFilter === p}
          onclick={() => (board.projectFilter = board.projectFilter === p ? "" : p)}
        >
          {p}
        </button>
      {/each}
    </div>
    <div class="meta">{board.activeCount} tasks</div>
    <button class="theme-toggle" onclick={toggleTheme} title="toggle theme">
      {theme === "dark" ? "☀" : "☾"}
    </button>
  </header>

  {#if board.loading}
    <div class="state">loading board…</div>
  {:else}
    <main class="board">
      {#each board.lanes as lane, i (lane.id)}
        <LaneView {lane} index={i} />
      {/each}
      <AddLane />
    </main>
  {/if}

  {#if board.editing}
    <!-- keyed: navigating parent ↔ child inside the modal must remount it with fresh state -->
    {#key board.editing.id}
      {#if board.editMode}
        <TaskEditor />
      {:else}
        <TaskDetail />
      {/if}
    {/key}
  {/if}

  {#if board.error}
    <button class="error-bar" onclick={() => (board.error = "")}>{board.error}</button>
  {/if}
</div>
