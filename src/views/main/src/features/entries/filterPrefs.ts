// Reine UI-Präferenz (Filter-Sidebar eingeklappt?) → in localStorage, kein RPC.
// Nach dem Muster von lib/theme.ts: try/catch-gekapselt, defensiv für Tests.

const COLLAPSED_KEY = "entries.filters.collapsed";

export function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveCollapsed(value: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, value ? "true" : "false");
  } catch {
    // localStorage nicht verfügbar (z.B. Tests) — kein Persistieren.
  }
}
