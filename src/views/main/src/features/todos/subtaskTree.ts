import type { TodoList, TodoTask } from "../../../../../shared/types";

// Liefert die direkten und tieferen Subtasks eines Tasks aus der geordneten
// Task-Liste seiner Liste: die zusammenhängende Folge nach dem Task mit
// depth > task.depth, bis zum nächsten Task mit depth <= task.depth.
// Reine Hilfsfunktion (keine Mutation) — testbar isoliert.
export function subtasksOf(ordered: TodoTask[], task: TodoTask): TodoTask[] {
  const index = ordered.findIndex((t) => t.id === task.id);
  if (index === -1) return [];
  const result: TodoTask[] = [];
  for (let i = index + 1; i < ordered.length; i++) {
    if (ordered[i].depth <= task.depth) break;
    result.push(ordered[i]);
  }
  return result;
}

// Löst das Detail-Panel auf: den Task per id + dessen Subtree aus der geordneten
// Liste seiner Liste. Kapselt die Lookup-Kette, damit die Page schlank bleibt.
export function resolveDetail(
  lists: TodoList[],
  detailTaskId: string | null,
): { task: TodoTask | null; subtasks: TodoTask[] } {
  const task = lists.flatMap((l) => l.tasks).find((t) => t.id === detailTaskId) ?? null;
  const list = task ? lists.find((l) => l.id === task.listId) : undefined;
  return { task, subtasks: task && list ? subtasksOf(list.tasks, task) : [] };
}
