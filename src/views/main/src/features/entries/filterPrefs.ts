// Reine UI-Präferenz (Filter-Sidebar eingeklappt?) → in localStorage, kein RPC.
// Nach dem Muster von lib/theme.ts: try/catch-gekapselt, defensiv für Tests.

import type { EntryStatus } from "../../../../../shared/types";
import type { RangePreset } from "../../lib/dates";

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

// Bewusste Abweichung vom /tickets-Muster (URL-Search-Params): /entries hat keine
// Detail-Subroute, und Nav-Klicks (<Link to="/entries">) tragen keine Search-Params,
// remounten die Page also ohne Filter. Darum persistieren wir den Filter-Zustand
// in localStorage statt in der URL.
export interface PersistedFilterState {
  status: EntryStatus | "";
  from: string;
  to: string;
  preset: RangePreset | null;
  tagIds: number[];
  nodes: string[];
}

const FILTER_KEY = "entries.filters.state";

export function loadFilterState(): PersistedFilterState | null {
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.tagIds) || !Array.isArray(parsed.nodes)) return null;
    return {
      status: String(parsed.status ?? "") as EntryStatus | "",
      from: String(parsed.from ?? ""),
      to: String(parsed.to ?? ""),
      preset: (parsed.preset ?? null) as RangePreset | null,
      tagIds: parsed.tagIds,
      nodes: parsed.nodes,
    };
  } catch {
    return null;
  }
}

export function saveFilterState(state: PersistedFilterState): void {
  try {
    localStorage.setItem(FILTER_KEY, JSON.stringify(state));
  } catch {
    // localStorage nicht verfügbar (z.B. Tests) — kein Persistieren.
  }
}
