import type { TodoTask } from "../../../../../shared/types";

// Berechnet pro Task, ob Einrücken/Ausrücken erlaubt ist — spiegelt die
// Backend-Regel (TODO_REINDENT bei ungültiger Operation), damit die UI Buttons
// vorab disablen kann. `ordered` MUSS die globale Datei-Reihenfolge sein, weil
// canIndent vom unmittelbaren Vorgänger abhängt.
export function reindentAbility(
  ordered: TodoTask[],
): Map<string, { canIndent: boolean; canOutdent: boolean }> {
  const result = new Map<string, { canIndent: boolean; canOutdent: boolean }>();
  for (let i = 0; i < ordered.length; i++) {
    const task = ordered[i];
    const canOutdent = task.depth >= 1;
    // Einrücken nur, wenn ein Vorgänger existiert, der nicht flacher ist als der
    // Task selbst — sonst entstünde ein Subtask ohne gültigen Eltern-Knoten.
    const canIndent = i > 0 && ordered[i - 1].depth >= task.depth;
    result.set(task.id, { canIndent, canOutdent });
  }
  return result;
}
