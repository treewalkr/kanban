<script lang="ts">
  import type { Task } from "../../../src/db";
  import { board } from "./board.svelte";
  import { timeAgo } from "./util";

  let { task }: { task: Task } = $props();
</script>

<div
  class="card"
  class:dragging={board.dragging === task.id}
  draggable="true"
  data-card={task.id}
  role="button"
  tabindex="0"
  onclick={() => (board.editing = task)}
  onkeydown={(e) => {
    if (e.key === "Enter") board.editing = task;
  }}
  ondragstart={(e) => {
    e.dataTransfer!.setData("text/plain", task.id);
    e.dataTransfer!.effectAllowed = "move";
    board.dragging = task.id;
  }}
  ondragend={() => {
    board.dragging = null;
    board.dropHint = null;
  }}
>
  <div class="card-title">{task.title}</div>
  {#if task.note}<p class="card-note">{task.note}</p>{/if}
  <div class="card-meta">
    <span class="id">{task.id}</span>
    {#if task.project}<span class="chip">{task.project}</span>{/if}
    <span class="age" title={new Date(task.updatedAt).toLocaleString()}>{timeAgo(task.updatedAt)}</span>
  </div>
</div>
