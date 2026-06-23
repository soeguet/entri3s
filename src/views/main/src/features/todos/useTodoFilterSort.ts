import { useState } from "react";
import type { TodoPriority } from "../../../../../shared/types";
import { EMPTY_FILTER, isFilterActive, type TodoFilter, type TodoSort } from "./taskFilterSort";

// Reine State-Verwaltung für Filter + Sortierung der Todo-Listenansicht.
// Toggle-Helfer schalten einen Tag/eine Priorität in der jeweiligen Facette
// an/aus (ODER innerhalb der Facette).
export function useTodoFilterSort(): {
  filter: TodoFilter;
  sort: TodoSort;
  setSort: (sort: TodoSort) => void;
  toggleTag: (tag: string) => void;
  togglePriority: (priority: TodoPriority) => void;
  setStatus: (status: TodoFilter["status"]) => void;
  setAll: (filter: TodoFilter, sort: TodoSort) => void;
  reset: () => void;
  active: boolean;
} {
  const [filter, setFilter] = useState<TodoFilter>(EMPTY_FILTER);
  const [sort, setSort] = useState<TodoSort>("manual");

  function toggleTag(tag: string) {
    setFilter((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }));
  }
  function togglePriority(priority: TodoPriority) {
    setFilter((prev) => ({
      ...prev,
      priorities: prev.priorities.includes(priority)
        ? prev.priorities.filter((p) => p !== priority)
        : [...prev.priorities, priority],
    }));
  }
  function setStatus(status: TodoFilter["status"]) {
    setFilter((prev) => ({ ...prev, status }));
  }
  // Komplette Filter+Sort-Übernahme (z.B. beim Anwenden eines Saved Filter).
  function setAll(nextFilter: TodoFilter, nextSort: TodoSort) {
    setFilter(nextFilter);
    setSort(nextSort);
  }
  function reset() {
    setFilter(EMPTY_FILTER);
    setSort("manual");
  }

  return {
    filter,
    sort,
    setSort,
    toggleTag,
    togglePriority,
    setStatus,
    setAll,
    reset,
    active: isFilterActive(filter) || sort !== "manual",
  };
}
