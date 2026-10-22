<script lang="ts">
  import type { AgentConfig, AgentRole, AgentThinking } from "../../../src/db";
  import { agents } from "./agents.svelte";

  interface AgentForm {
    provider: string;
    model: string;
    thinking: string;
    skills: string;
    context: string;
    tools: string;
    extraArgs: string;
    timeoutMin: string;
  }

  const toForm = (cfg: AgentConfig): AgentForm => ({
    provider: cfg.provider ?? "",
    model: cfg.model ?? "",
    thinking: cfg.thinking ?? "",
    skills: (cfg.skills ?? []).join("\n"),
    context: cfg.context ?? "",
    tools: cfg.tools ?? "",
    extraArgs: (cfg.extraArgs ?? []).join("\n"),
    timeoutMin: cfg.timeoutMs ? String(Math.round(cfg.timeoutMs / 60_000)) : "",
  });

  const toConfig = (f: AgentForm): AgentConfig => ({
    provider: f.provider,
    model: f.model,
    thinking: f.thinking as AgentThinking, // the select only offers valid levels
    skills: f.skills.split("\n").map((s) => s.trim()).filter(Boolean),
    context: f.context,
    tools: f.tools,
    extraArgs: f.extraArgs.split("\n").map((s) => s.trim()).filter(Boolean),
    timeoutMs: f.timeoutMin ? Number(f.timeoutMin) * 60_000 : undefined,
  });

  let role = $state<AgentRole>("reviewer");
  let form = $state<AgentForm>(toForm(agents.reviewer));
  let saving = $state(false);

  // tab switch stashes edits in the store so the other role's form can load
  function switchRole(next: AgentRole): void {
    if (next === role) return;
    agents[role] = toConfig(form);
    role = next;
    form = toForm(agents[next]);
  }

  async function save(): Promise<void> {
    if (saving) return;
    saving = true;
    const ok = await agents.save(role, toConfig(form));
    saving = false;
    if (ok) agents.open = false;
  }

  function autofocus(node: HTMLElement) {
    node.focus();
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key === "Escape") agents.open = false; }} />

<div
  class="overlay"
  role="presentation"
  onclick={(e) => {
    if (e.target === e.currentTarget) agents.open = false;
  }}
>
  <div class="editor" role="dialog" aria-modal="true" aria-label="agent settings" tabindex="-1" use:autofocus>
    <div class="agent-tabs">
      <button class:active={role === "reviewer"} onclick={() => switchRole("reviewer")}>reviewer</button>
      <button class:active={role === "builder"} onclick={() => switchRole("builder")}>builder</button>
    </div>
    <div class="row">
      <label>
        provider
        <input bind:value={form.provider} placeholder="pi default (e.g. anthropic)" />
      </label>
      <label>
        model
        <input bind:value={form.model} placeholder="pi default" />
      </label>
    </div>
    <div class="row">
      <label>
        thinking
        <select bind:value={form.thinking}>
          <option value="">default{role === "reviewer" ? " (max)" : ""}</option>
          <option value="off">off</option>
          <option value="minimal">minimal</option>
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
          <option value="xhigh">xhigh</option>
          <option value="max">max</option>
        </select>
      </label>
      <label>
        timeout · min
        <input inputmode="numeric" bind:value={form.timeoutMin} placeholder="20" />
      </label>
    </div>
    <label>
      skills · one path per line → --skill
      <textarea bind:value={form.skills} rows="2" placeholder={"~/.pi/agent/skills/scrutinize"}></textarea>
    </label>
    <label>
      context · appended to the system prompt
      <textarea
        bind:value={form.context}
        rows="3"
        placeholder={"standing instructions the agent always gets — review lens, conventions, hard rules…"}
      ></textarea>
    </label>
    <label>
      tools
      <input bind:value={form.tools} placeholder="pi default (e.g. -edit,+bash)" />
    </label>
    <label>
      extra pi flags · one per line
      <textarea bind:value={form.extraArgs} rows="2" placeholder="--no-mcp"></textarea>
    </label>
    <div class="editor-actions">
      <span class="spacer"></span>
      <button class="ghost" onclick={() => (agents.open = false)}>cancel</button>
      <button class="primary" onclick={save} disabled={saving}>save</button>
    </div>
  </div>
</div>
