<script lang="ts">
  import { theme, setTheme } from "./theme.svelte";
</script>

<div class="settings-general">
  <section class="settings-general-section">
    <h3 class="settings-general-heading">Appearance</h3>
    <p class="settings-general-description">Color scheme for the board. Applies immediately and is remembered by the browser.</p>
    <div class="seg" role="radiogroup" aria-label="theme">
      <label class="seg-option">
        <input class="sr-only" type="radio" name="theme" value="dark" bind:group={theme.name} onchange={() => setTheme("dark")} />
        <span class="seg-label">dark</span>
      </label>
      <label class="seg-option">
        <input class="sr-only" type="radio" name="theme" value="light" bind:group={theme.name} onchange={() => setTheme("light")} />
        <span class="seg-label">light</span>
      </label>
    </div>
  </section>
</div>
