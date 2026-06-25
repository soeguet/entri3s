import type { TodoList, TodoTask } from "../../../../../shared/types";
import { subtasksOf } from "./subtaskTree";
import { toast } from "../../lib/toast";

// Entscheidet, ob beim Abhaken eines Tasks ein Undo-Toast angeboten wird.
// Nur beim Abhaken (completing) nicht-wiederkehrender Tasks OHNE offene Subtasks:
// - Recurrence: das Backend rollt beim Abhaken eine neue Folge-Instanz; ein
//   simples done:false revertiert diese NICHT → "Rückgängig" wäre irreführend.
// - Variante A: unsere Kaskade hakt offene Subtasks mit ab; ein einfaches
//   Parent-Undo setzt diese NICHT zurück → ebenfalls irreführend, daher kein Undo.
function shouldOfferUndo(task: TodoTask, completing: boolean, lists: TodoList[]): boolean {
  if (!completing || task.recurrence !== null) return false;
  const list = lists.find((l) => l.id === task.listId);
  const hasOpenSubtasks = list ? subtasksOf(list.tasks, task).some((st) => !st.done) : false;
  return !hasOpenSubtasks;
}

// Baut die mutate-Options für das Abhaken: bei erlaubtem Undo (siehe oben) ein
// onSuccess, das einen "Rückgängig"-Toast zeigt; sonst undefined (kein Toast).
// onUndo setzt den Task wieder offen (done:false). Hält onToggle in der Page schlank.
export function undoToggleOptions(
  task: TodoTask,
  completing: boolean,
  lists: TodoList[],
  onUndo: () => void,
): { onSuccess: () => void } | undefined {
  if (!shouldOfferUndo(task, completing, lists)) return undefined;
  return {
    // Ohne eigenen onSuccess am Undo-mutate → kein erneuter Toast (kein Loop).
    onSuccess: () =>
      toast.success(`Erledigt: ${task.title}`, { label: "Rückgängig", onAction: onUndo }),
  };
}
