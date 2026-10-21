<script lang="ts">
  import type { Task } from "../../../src/db";
  import { board } from "./board.svelte";
  import { renderMarkdown } from "./markdown";
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
  onclick={() => board.openCard(task)}
  onkeydown={(e) => {
    if (e.key === "Enter") board.openCard(task);
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
  {#if task.note}<div class="card-note md">{@html renderMarkdown(task.note)}</div>{/if}
  <div class="card-meta">
    <span class="id">{task.id}</span>
    {#if task.project}<span class="chip">{task.project}</span>{/if}
    <span class="age" title={new Date(task.updatedAt).toLocaleString()}>{timeAgo(task.updatedAt)}</span>
  </div>
</div>
