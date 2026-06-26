import { useState } from "react";
import { loadTodoPrefs } from "./todoPrefs";
import type { SmartView } from "./smartViewFilter";

// Hält view + selectedList der /todos-Seite, lazy initialisiert aus localStorage
// (loadTodoPrefs). filter/sort liegen weiterhin in useTodoFilterSort; das
// Persistieren des kompletten Blobs macht TodosPage in EINEM useEffect, damit
// die Persistenz-Quelle an einer Stelle bleibt und TodosPage schlank bleibt.
export function useTodoUiPrefs(): {
  view: SmartView;
  selectedList: string | null;
  combined: boolean;
  setView: (view: SmartView) => void;
  setSelectedList: (list: string | null) => void;
  setCombined: (combined: boolean) => void;
} {
  const initial = loadTodoPrefs();
  const [view, setView] = useState<SmartView>(initial?.view ?? "today");
  const [selectedList, setSelectedList] = useState<string | null>(initial?.selectedList ?? null);
  const [combined, setCombined] = useState<boolean>(initial?.combined ?? false);

  return { view, selectedList, combined, setView, setSelectedList, setCombined };
}
