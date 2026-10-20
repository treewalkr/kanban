import { api } from "../api";
import type { Lane, LanePatch, Task, TaskPatch } from "../../../src/db";

type EdenError = { value?: unknown };

class BoardStore {
  lanes = $state<Lane[]>([]);
  tasks = $state<Task[]>([]);
  loading = $state(true);
  error = $state("");
  search = $state("");
  projectFilter = $state("");
  editing = $state<Task | null>(null);
  editMode = $state(false);
  dragging = $state<string | null>(null);
  dropHint = $state<{ laneId: string; index: number } | null>(null);

  readonly projects = $derived(
    [...new Set(this.tasks.map((t) => t.project).filter((p) => p !== ""))].sort(),
  );

  openCard(task: Task): void {
    this.editing = task;
    this.editMode = false;
  }

  closeCard(): void {
    this.editing = null;
    this.editMode = false;
  }

  visibleTasks(laneId: string): Task[] {
    const q = this.search.trim().toLowerCase();
    return this.tasks
      .filter((t) => t.laneId === laneId)
      .filter((t) => (this.projectFilter ? t.project === this.projectFilter : true))
      .filter((t) =>
        q ? `${t.title} ${t.note} ${t.id} ${t.project}`.toLowerCase().includes(q) : true,
      )
      .sort((a, b) => a.position - b.position);
  }

  laneCount(laneId: string): number {
    return this.tasks.filter((t) => t.laneId === laneId).length;
  }

  private fail(error: EdenError): void {
    const value = error.value as { error?: string } | undefined;
    this.error = value?.error ?? "request failed";
  }

  async refresh(): Promise<void> {
    const { data, error } = await api.board.get();
    if (error) {
      this.fail(error);
      return;
    }
    this.error = "";
    this.lanes = data.lanes;
    this.tasks = data.tasks;
    this.loading = false;
  }

  async addTask(laneId: string, title: string, project = this.projectFilter): Promise<void> {
    const { error } = await api.tasks.post({ title, lane: laneId, project: project || undefined });
    if (error) return this.fail(error);
    await this.refresh();
  }

  async updateTask(id: string, patch: TaskPatch): Promise<void> {
    const { error } = await api.tasks({ id }).patch(patch);
    if (error) return this.fail(error);
    await this.refresh();
  }

  async moveTask(id: string, laneId: string, index?: number): Promise<void> {
    await this.updateTask(id, { lane: laneId, index });
  }

  async deleteTask(id: string): Promise<void> {
    const { error } = await api.tasks({ id }).delete();
    if (error) return this.fail(error);
    this.closeCard();
    await this.refresh();
  }

  async addLane(name: string): Promise<void> {
    const { error } = await api.lanes.post({ name });
    if (error) return this.fail(error);
    await this.refresh();
  }

  async updateLane(id: string, patch: LanePatch): Promise<void> {
    const { error } = await api.lanes({ id }).patch(patch);
    if (error) return this.fail(error);
    await this.refresh();
  }

  async renameLane(id: string, name: string): Promise<void> {
    await this.updateLane(id, { name });
  }

  async moveLane(id: string, index: number): Promise<void> {
    await this.updateLane(id, { index });
  }

  async removeLane(id: string): Promise<void> {
    const { error } = await api.lanes({ id }).delete();
    if (error) return this.fail(error);
    await this.refresh();
  }
}

export const board = new BoardStore();
