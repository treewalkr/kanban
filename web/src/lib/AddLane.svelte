<script lang="ts">
  import { board } from "./board.svelte";

  let open = $state(false);
  let value = $state("");

  function autofocus(node: HTMLInputElement) {
    node.focus();
  }

  async function submit() {
    const name = value.trim();
    if (name) await board.addLane(name);
    value = "";
    open = false;
  }
</script>

{#if open}
  <div class="lane add-lane open">
    <input
      bind:value
      use:autofocus
      placeholder="lane name…"
      onkeydown={(e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") open = false;
      }}
      onblur={() => {
        if (!value.trim()) open = false;
      }}
    />
  </div>
{:else}
  <button class="lane add-lane" onclick={() => (open = true)}>+ lane</button>
{/if}
