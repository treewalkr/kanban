<script lang="ts">
  import { onMount } from "svelte";
  import { board } from "./lib/board.svelte";
  import LaneView from "./lib/Lane.svelte";
  import TaskEditor from "./lib/TaskEditor.svelte";
  import AddLane from "./lib/AddLane.svelte";

  onMount(() => board.refresh());

  // keep the board in sync with CLI-side writes
  $effect(() => {
    const t = setInterval(() => {
      if (!document.hidden && !board.editing) board.refresh();
    }, 3000);
    return () => clearInterval(t);
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
    <div class="meta">{board.tasks.length} tasks</div>
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
    <TaskEditor />
  {/if}

  {#if board.error}
    <button class="error-bar" onclick={() => (board.error = "")}>{board.error}</button>
  {/if}
</div>
