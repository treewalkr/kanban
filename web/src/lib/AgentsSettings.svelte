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

  let providers = $derived([...new Set(agents.models.map((m) => m.provider))].sort());
  let modelGroups = $derived.by(() => {
    const forProvider = form.provider ? agents.models.filter((m) => m.provider === form.provider) : agents.models;
    const groups = new Map<string, Array<{ id: string; label: string }>>();
    for (const m of forProvider) {
      const list = groups.get(m.provider) ?? [];
      list.push({ id: m.id, label: `${m.id} · ${m.context}${m.thinking ? " · thinks" : ""}` });
      groups.set(m.provider, list);
    }
    return [...groups.entries()];
  });

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
</script>

<div class="settings-general settings-form">
  <div class="agent-tabs">
    <button class:active={role === "reviewer"} onclick={() => switchRole("reviewer")}>reviewer</button>
    <button class:active={role === "builder"} onclick={() => switchRole("builder")}>builder</button>
  </div>
    {#if agents.models.length > 0}
      <div class="row">
        <label>
          provider
          <select bind:value={form.provider}>
            <option value="">pi default</option>
            {#each providers as p (p)}
              <option value={p}>{p}</option>
            {/each}
            {#if form.provider && !providers.includes(form.provider)}
              <option value={form.provider}>{form.provider} · custom</option>
            {/if}
          </select>
        </label>
        <label>
          model
          <select
            bind:value={form.model}
            onchange={(e) => {
              const id = (e.currentTarget as HTMLSelectElement).value;
              const hit = agents.models.find((m) => m.id === id && (!form.provider || m.provider === form.provider));
              if (hit) form.provider = hit.provider;
            }}
          >
            <option value="">pi default</option>
            {#each modelGroups as [provider, ms] (provider)}
              <optgroup label={provider}>
                {#each ms as m (m.id)}
                  <option value={m.id}>{m.label}</option>
                {/each}
              </optgroup>
            {/each}
            {#if form.model && !agents.models.some((m) => m.id === form.model)}
              <option value={form.model}>{form.model} · custom</option>
            {/if}
          </select>
        </label>
      </div>
    {:else}
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
    {/if}
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
