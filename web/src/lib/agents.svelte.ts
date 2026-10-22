import { api } from "../api";
import type { AgentConfig, AgentRole } from "../../../src/db";
import type { CatalogModel } from "../../../src/models";
import { board } from "./board.svelte";

type EdenError = { value?: unknown };

/** Reviewer/builder agent settings for the auto-review loop; failures surface via the board toast. */
class AgentsStore {
  open = $state(false);
  loaded = $state(false);
  reviewer = $state<AgentConfig>({});
  builder = $state<AgentConfig>({});
  /** pi's catalog for the provider/model selects; empty → the panel falls back to text inputs. */
  models = $state<CatalogModel[]>([]);

  private fail(error: EdenError): void {
    const value = error.value as { error?: string } | undefined;
    board.error = value?.error ?? "request failed";
  }

  async load(): Promise<void> {
    const [agents, models] = await Promise.all([api.agents.get(), api["pi-models"].get()]);
    if (agents.error) this.fail(agents.error);
    else {
      this.reviewer = agents.data.reviewer ?? {};
      this.builder = agents.data.builder ?? {};
      this.loaded = true;
    }
    if (!models.error) this.models = models.data.models;
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
