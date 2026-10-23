<script lang="ts">
  import type { Snippet } from "svelte";

  let { title, note = "", children }: { title: string; note?: string; children?: Snippet } = $props();
</script>

<figure class="gallery-frame">
  <figcaption>
    <span class="gallery-frame-title">{title}</span>
    {#if note}<span class="gallery-frame-note">{note}</span>{/if}
  </figcaption>
  <div class="gallery-frame-body">{@render children?.()}</div>
</figure>
