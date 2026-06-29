import { useEffect, useState } from "react";
import type { EntryStatus } from "../../../../../shared/types";
import { rangeForPreset, type RangePreset } from "../../lib/dates";
import { loadFilterState, saveFilterState } from "./filterPrefs";

// Kapselt den Filter-/Range-/Tag-/Node-Zustand der EntriesPage samt Persistenz
// in localStorage. Reine Extraktion aus EntriesPage — kein Verhaltenswechsel.
export function useEntriesFilters() {
  // Filter-Zustand einmal beim Mount aus localStorage wiederherstellen (siehe
  // filterPrefs.ts), sonst Default "today".
  const [persisted] = useState(() => loadFilterState());
  const [status, setStatus] = useState<EntryStatus | "">(persisted?.status ?? "");
  const [from, setFrom] = useState(() =>
    persisted ? persisted.from : rangeForPreset("today").from,
  );
  const [to, setTo] = useState(() => (persisted ? persisted.to : rangeForPreset("today").to));
  const [activePreset, setActivePreset] = useState<RangePreset | null>(() =>
    persisted ? persisted.preset : "today",
  );
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(persisted?.tagIds ?? []);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(
    () => new Set(persisted?.nodes ?? []),
  );

  useEffect(() => {
    saveFilterState({
      status,
      from,
      to,
      preset: activePreset,
      tagIds: selectedTagIds,
      nodes: [...selectedNodes],
    });
  }, [status, from, to, activePreset, selectedTagIds, selectedNodes]);

  function applyPreset(preset: RangePreset) {
    const range = rangeForPreset(preset);
    setFrom(range.from);
    setTo(range.to);
    setActivePreset(preset);
  }
  function clearRange() {
    setFrom("");
    setTo("");
    setActivePreset(null);
  }
  function toggleTag(id: number) {
    setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }
  function onDay(day: string) {
    setFrom(day);
    setTo(day);
    setActivePreset(null);
  }

  return {
    status,
    setStatus,
    from,
    setFrom,
    to,
    setTo,
    activePreset,
    setActivePreset,
    selectedTagIds,
    setSelectedTagIds,
    selectedNodes,
    setSelectedNodes,
    applyPreset,
    clearRange,
    toggleTag,
    onDay,
  };
}
