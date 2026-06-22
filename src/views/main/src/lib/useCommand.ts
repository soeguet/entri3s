import { useEffect, useRef, useSyncExternalStore } from "react";

export interface Command {
  id: string;
  label: string;
  keywords?: string;
  section?: string;
  run: () => void;
}

// ── Modul-Singleton Registry ─────────────────────────────────────────────────
// Gleicher Ansatz wie useHotkey: ein einfaches Modul-Singleton ohne Context-
// Provider. useSyncExternalStore sorgt dafür, dass Konsumenten bei Änderungen
// re-rendern — und zwar nur wenn sich die Referenz des Snapshots ändert.

interface RegistryEntry {
  command: Command;
  source: symbol; // identifiziert die Mount-Instanz
}

let entries: RegistryEntry[] = [];
let snapshot: Command[] = [];
const listeners = new Set<() => void>();

function emit() {
  snapshot = entries.map((e) => e.command);
  for (const fn of listeners) fn();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): Command[] {
  return snapshot;
}

// ── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Registriert Commands solange die Komponente gemountet ist. Re-Registrierung
 * nur wenn sich die Menge der ids ändert. Die `run`-Funktion wird über einen
 * Ref delegiert, damit Closures (z.B. aktueller Filter) immer aktuell sind,
 * ohne die Registry ständig umzubauen.
 */
export function useCommands(commands: Command[]): void {
  const ref = useRef(commands);
  ref.current = commands;

  const ids = commands.map((c) => c.id).join(",");

  useEffect(() => {
    const token = Symbol();

    const proxied: RegistryEntry[] = ref.current.map((c) => ({
      command: {
        id: c.id,
        label: c.label,
        keywords: c.keywords,
        section: c.section,
        // Proxy: delegiert an den Ref, damit run() immer die aktuelle Closure
        // nutzt, ohne dass die Registry bei jedem Render neu gebaut wird.
        run: () => ref.current.find((x) => x.id === c.id)?.run(),
      },
      source: token,
    }));

    entries = [...entries, ...proxied];
    emit();

    return () => {
      entries = entries.filter((e) => e.source !== token);
      emit();
    };
    // ids-String als Dep: re-registriert nur wenn die Menge der Command-IDs
    // sich ändert — label/keywords/run-Änderungen laufen über den Ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);
}

/**
 * Subscribt auf die Registry und liefert alle aktuell registrierten Commands
 * als stabilen Snapshot (useSyncExternalStore).
 */
export function useRegisteredCommands(): Command[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
