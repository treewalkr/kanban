<script lang="ts">
  import type { Task } from "../../../src/db";
  import { board } from "./board.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";

  const source = board.editing!;

  let title = $state(source.title);
  let note = $state(source.note);
  let project = $state(source.project);
  let laneId = $state(source.laneId);
  let parentId = $state(source.parentId ?? "");
  let confirming = $state(false);

  // candidates mirror the api rule: depth(candidate) + 1 + subtree height ≤ 2
  let candidates = $derived.by(() => {
    const heightOf = (id: string): number => {
      const kids = board.childrenOf(id);
      return kids.length === 0 ? 0 : 1 + Math.max(...kids.map((k) => heightOf(k.id)));
    };
    const banned = new Set([source.id, ...board.descendantsOf(source.id).map((t) => t.id)]);
    const height = heightOf(source.id);
    return board.tasks
      .filter((t) => !banned.has(t.id))
      .filter((t) => board.ancestorsOf(t.id).length + 1 + height <= 2)
      .sort((a, b) => a.title.localeCompare(b.title));
  });

  let descendantCount = $derived(board.descendantsOf(source.id).length);

  async function save() {
    if (!title.trim()) return;
    await board.updateTask(source.id, {
      title: title.trim(),
      note,
      project: project.trim(),
      lane: laneId,
      parent: parentId || null,
    });
    board.closeCard();
  }

  function confirmRemove() {
    confirming = false;
    board.deleteTask(source.id, true); // the confirm dialog is the guard
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key !== "Escape") return;
    if (confirming) confirming = false;
    else board.closeCard();
  }}
/>

<div
  class="overlay"
  role="presentation"
  onclick={(e) => {
    if (e.target === e.currentTarget) board.closeCard();
  }}
>
  <div class="editor" role="dialog" aria-label="edit card">
    <label>
      title
      <input bind:value={title} />
    </label>
    <label>
      note
      <textarea bind:value={note} rows="6" placeholder="details, links, acceptance criteria… (markdown ok)"></textarea>
    </label>
    <div class="row">
      <label>
        project
        <input list="editor-projects" bind:value={project} placeholder="optional tag" />
        <datalist id="editor-projects">
          {#each board.projects as p (p)}<option value={p}></option>{/each}
        </datalist>
      </label>
      <label>
        lane
        <select bind:value={laneId}>
          {#each board.lanes as l (l.id)}<option value={l.id}>{l.name}</option>{/each}
        </select>
      </label>
    </div>
    <label>
      parent
      <select bind:value={parentId}>
        <option value="">(none)</option>
        {#each candidates as c (c.id)}
          <option value={c.id}>{c.title} · {c.id}</option>
        {/each}
      </select>
    </label>
    <div class="editor-actions">
      <span class="id">{source.id}</span>
      <span class="spacer"></span>
      <button class="danger" onclick={() => (confirming = true)}>delete</button>
      <button class="primary" onclick={save} disabled={!title.trim()}>save</button>
    </div>
  </div>
</div>

{#if confirming}
  <ConfirmDialog
    title="Delete card"
    message={
      descendantCount > 0
        ? 'Permanently delete “' +
          source.title +
          '” and its ' +
          (descendantCount === 1 ? '1 subtask' : descendantCount + ' subtasks') +
          '? There is no undo.'
        : 'Permanently delete “' + source.title + '”? There is no undo.'
    }
    onconfirm={confirmRemove}
    oncancel={() => (confirming = false)}
  />
{/if}
