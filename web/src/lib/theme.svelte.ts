/** Shared theme state: header toggle and the settings picker both go through setTheme. */
export const theme = $state({
  name: (document.documentElement.dataset.theme === "light" ? "light" : "dark") as "dark" | "light",
});

export function setTheme(name: "dark" | "light"): void {
  theme.name = name;
  document.documentElement.dataset.theme = name;
  localStorage.setItem("kanban-theme", name);
}
