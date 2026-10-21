<script lang="ts">
  import { board } from "./board.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";

  const source = board.editing!;

  let title = $state(source.title);
  let note = $state(source.note);
  let project = $state(source.project);
  let laneId = $state(source.laneId);
  let confirming = $state(false);

  async function save() {
    if (!title.trim()) return;
    await board.updateTask(source.id, {
      title: title.trim(),
      note,
      project: project.trim(),
      lane: laneId,
    });
    board.closeCard();
  }

  function confirmRemove() {
    confirming = false;
    board.deleteTask(source.id);
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
    message={'Permanently delete “' + source.title + '”? There is no undo.'}
    onconfirm={confirmRemove}
    oncancel={() => (confirming = false)}
  />
{/if}
