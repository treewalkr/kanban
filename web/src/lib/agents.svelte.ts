import { api } from "../api";
import type { AgentConfig, AgentRole } from "../../../src/db";
import { board } from "./board.svelte";

type EdenError = { value?: unknown };

/** Reviewer/builder agent settings for the auto-review loop; failures surface via the board toast. */
class AgentsStore {
  open = $state(false);
  loaded = $state(false);
  reviewer = $state<AgentConfig>({});
  builder = $state<AgentConfig>({});

  private fail(error: EdenError): void {
    const value = error.value as { error?: string } | undefined;
    board.error = value?.error ?? "request failed";
  }

  async load(): Promise<void> {
    const { data, error } = await api.agents.get();
    if (error) return this.fail(error);
    this.reviewer = data.reviewer ?? {};
    this.builder = data.builder ?? {};
    this.loaded = true;
  }

  async save(role: AgentRole, config: AgentConfig): Promise<boolean> {
    const { error } = await api.agents({ role }).put(config);
    if (error) {
      this.fail(error);
      return false;
    }
    this[role] = config;
    return true;
  }
}

export const agents = new AgentsStore();
