import type { TodoTask } from "../../../../../shared/types";

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
