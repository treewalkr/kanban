<script lang="ts">
  import { board } from "./board.svelte";
  import { renderMarkdown } from "./markdown";
  import { laneColor, timeAgo } from "./util";

  const task = board.editing!;

  let laneIndex = $derived(Math.max(0, board.lanes.findIndex((l) => l.id === task.laneId)));
  let laneName = $derived(board.lanes[laneIndex]?.name ?? task.laneId);

  const fmt = (ts: number) => new Date(ts).toLocaleString();

  async function toLane(laneId: string) {
    await board.moveTask(task.id, laneId);
    board.closeCard();
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") board.closeCard();
  }}
/>

<div
  class="overlay"
  role="presentation"
  onclick={(e) => {
    if (e.target === e.currentTarget) board.closeCard();
  }}
>
  <div class="editor detail" role="dialog" aria-label="card details" style="--accent: {laneColor(laneIndex)}">
    <div class="detail-head">
      <span class="lane-dot"></span>
      <span class="detail-lane">{laneName}</span>
      {#if task.project}<span class="chip">{task.project}</span>{/if}
    </div>
    <h2 class="detail-title">{task.title}</h2>
    {#if task.note}
      <div class="detail-note md">{@html renderMarkdown(task.note)}</div>
    {:else}
      <p class="detail-note empty">no note</p>
    {/if}
    <div class="detail-meta">
      <div><span class="k">created</span>{fmt(task.createdAt)}</div>
      <div><span class="k">updated</span>{fmt(task.updatedAt)} · {timeAgo(task.updatedAt)}</div>
    </div>
    <div class="editor-actions">
      <span class="id">{task.id}</span>
      <span class="spacer"></span>
      {#if task.laneId !== "done"}
        <button class="ghost" onclick={() => toLane("done")}>✓ done</button>
      {/if}
      {#if task.laneId !== "archive"}
        <button class="ghost" onclick={() => toLane("archive")}>archive</button>
      {/if}
      <button class="primary" onclick={() => (board.editMode = true)}>edit</button>
    </div>
  </div>
</div>
