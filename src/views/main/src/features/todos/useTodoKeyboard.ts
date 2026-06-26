import type { RefObject } from "react";
import type { TodoTask } from "../../../../../shared/types";
import { reschedulePresetDate } from "../../lib/dates";
import { useHotkey } from "../../lib/useHotkey";
import { useCommands } from "../../lib/useCommand";
import type { SmartView } from "./smartViewFilter";

// Kapselt die Tastatur-Shortcuts und CommandPalette-Einträge der TodosPage.
// Reines Verdrahten vorhandener Callbacks/State — keine eigene Logik, damit die
// Page schlank bleibt. Verhalten 1:1 wie zuvor inline.
export function useTodoKeyboard(params: {
  quickAddRef: RefObject<HTMLInputElement | null>;
  today: string;
  moveSelection: (delta: number) => void;
  selectedTask: () => TodoTask | undefined;
  onToggle: (task: TodoTask) => void;
  onReschedule: (task: TodoTask, due: string | null) => void;
  openDetail: (task: TodoTask) => void;
  onIndent: (task: TodoTask, direction: "indent" | "outdent") => void;
  openSearch: () => void;
  setView: (view: SmartView) => void;
  setSelectedList: (id: string | null) => void;
}): void {
  // Abhaken nur, wenn der Task nicht eine nicht-app-editierbare Wiederholung ist.
  function toggleSelected() {
    const t = params.selectedTask();
    if (t && !(t.recurrence !== null && !t.recurrenceEditableInApp)) params.onToggle(t);
  }
  function toView(view: SmartView) {
    params.setSelectedList(null);
    params.setView(view);
  }

  useHotkey("n", () => params.quickAddRef.current?.focus());
  useHotkey("j", () => params.moveSelection(1));
  useHotkey("k", () => params.moveSelection(-1));
  useHotkey("space", toggleSelected);
  useHotkey("x", toggleSelected);
  useHotkey("t", () => {
    const t = params.selectedTask();
    if (t) params.onReschedule(t, params.today);
  });
  useHotkey("#", () => {
    const t = params.selectedTask();
    if (t) params.onReschedule(t, reschedulePresetDate("tomorrow", params.today));
  });
  // page-scope (Default): feuert nicht bei offenem Detail-Dialog → kein Re-Open.
  useHotkey("o", () => {
    const t = params.selectedTask();
    if (t) params.openDetail(t);
  });
  useHotkey("f", params.openSearch);
  useHotkey("tab", () => {
    const t = params.selectedTask();
    if (t) params.onIndent(t, "indent");
  });
  useHotkey("shift+tab", () => {
    const t = params.selectedTask();
    if (t) params.onIndent(t, "outdent");
  });

  useCommands([
    {
      id: "todos:add",
      label: "Aufgabe hinzufügen",
      section: "Todos",
      run: () => params.quickAddRef.current?.focus(),
    },
    { id: "todos:search", label: "Aufgabe suchen", section: "Todos", run: params.openSearch },
    {
      id: "todos:detail",
      label: "Task-Details öffnen",
      section: "Todos",
      run: () => {
        const t = params.selectedTask();
        if (t) params.openDetail(t);
      },
    },
    { id: "todos:today", label: "Smart-View: Heute", section: "Todos", run: () => toView("today") },
    {
      id: "todos:overdue",
      label: "Smart-View: Überfällig",
      section: "Todos",
      run: () => toView("overdue"),
    },
    {
      id: "todos:upcoming",
      label: "Smart-View: Anstehend",
      section: "Todos",
      run: () => toView("upcoming"),
    },
    { id: "todos:all", label: "Smart-View: Alle", section: "Todos", run: () => toView("all") },
  ]);
}
