import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TodoTaskCreate, TodoTaskPatch } from "../../../../../shared/types";
import {
  addTodoTask,
  createTodoList,
  deleteTodoTask,
  moveTodoTask,
  reorderTodoTask,
  updateTodoTask,
} from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";

// Alle Todo-Mutationen gebündelt. KEINE optimistic updates/rollback (gibt es im
// Codebase nicht) — stattdessen instant invalidateQueries wie der Rest der App.
// Alle Mutationen sind silentError: Fehler (v.a. TODO_CONFLICT) werden inline am
// Ort der Eingabe angezeigt, nicht als anonymer Toast. Die getippte Eingabe
// verwirft der Aufrufer NICHT (siehe TodoRow/QuickAdd).
export function useTodoMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: keys.todos() });

  const add = useMutation({
    mutationFn: async (input: TodoTaskCreate) => unwrap(await addTodoTask(input)),
    onSuccess: invalidate,
    meta: { silentError: true },
  });

  const update = useMutation({
    mutationFn: async (patch: TodoTaskPatch) => unwrap(await updateTodoTask(patch)),
    onSuccess: invalidate,
    meta: { silentError: true },
  });

  const remove = useMutation({
    mutationFn: async (vars: { id: string; listId: string }) =>
      unwrap(await deleteTodoTask(vars.id, vars.listId)),
    onSuccess: invalidate,
    meta: { silentError: true },
  });

  const move = useMutation({
    mutationFn: async (vars: {
      id: string;
      fromList: string;
      toList: string;
      toSection?: string | null;
    }) => unwrap(await moveTodoTask(vars.id, vars.fromList, vars.toList, vars.toSection)),
    onSuccess: invalidate,
    meta: { silentError: true },
  });

  const reorder = useMutation({
    mutationFn: async (vars: { listId: string; id: string; targetId: string; before: boolean }) =>
      unwrap(await reorderTodoTask(vars.listId, vars.id, vars.targetId, vars.before)),
    onSuccess: invalidate,
    meta: { silentError: true },
  });

  const createList = useMutation({
    mutationFn: async (name: string) => unwrap(await createTodoList(name)),
    onSuccess: invalidate,
    meta: { silentError: true },
  });

  return { add, update, remove, move, reorder, createList };
}
