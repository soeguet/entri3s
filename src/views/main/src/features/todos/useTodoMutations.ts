import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TodoTask, TodoTaskCreate, TodoTaskPatch } from "../../../../../shared/types";
import {
  addTodoTask,
  createTodoList,
  deleteTodoTask,
  moveTodoTask,
  reindentTodoTask,
  reorderTodoTask,
  updateTodoTask,
} from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { toast } from "../../lib/toast";

// Bulk-Aktion über mehrere Tasks. Jede Variante führt pro Task den passenden
// bestehenden Single-RPC aus (kein neuer Backend-Code).
export type BulkOp =
  | { kind: "complete"; tasks: TodoTask[] }
  | { kind: "delete"; tasks: TodoTask[] }
  | { kind: "reschedule"; tasks: TodoTask[]; due: string | null }
  | { kind: "move"; tasks: TodoTask[]; toList: string };

// Führt den passenden Single-RPC für EINEN Task aus und wirft bei RpcError
// (unwrap), damit allSettled das als rejected zählt.
async function runBulkTask(op: BulkOp, t: TodoTask): Promise<void> {
  if (op.kind === "complete") {
    unwrap(await updateTodoTask({ id: t.id, listId: t.listId, done: true }));
    return;
  }
  if (op.kind === "reschedule") {
    unwrap(await updateTodoTask({ id: t.id, listId: t.listId, due: op.due }));
    return;
  }
  if (op.kind === "delete") {
    unwrap(await deleteTodoTask(t.id, t.listId));
    return;
  }
  unwrap(await moveTodoTask(t.id, t.listId, op.toList));
}

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

  const reindent = useMutation({
    mutationFn: async (vars: { listId: string; id: string; direction: "indent" | "outdent" }) =>
      unwrap(await reindentTodoTask(vars.listId, vars.id, vars.direction)),
    onSuccess: invalidate,
    meta: { silentError: true },
  });

  const createList = useMutation({
    mutationFn: async (name: string) => unwrap(await createTodoList(name)),
    onSuccess: invalidate,
    meta: { silentError: true },
  });

  // Bulk: pro Task ein bestehender Single-RPC via Promise.allSettled. silentError,
  // damit NICHT zusätzlich der globale Fehler-Toast aus queryClient feuert — wir
  // zeigen hier einen eigenen, aussagekräftigen Toast (Erfolg / Anzahl fehlge-
  // schlagen), da Teil-Erfolge bei Bulk normal sind.
  const bulk = useMutation({
    mutationFn: async (op: BulkOp) => {
      const results = await Promise.allSettled(op.tasks.map((t) => runBulkTask(op, t)));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) throw new Error(String(failed));
    },
    onSuccess: () => {
      invalidate();
      toast.success("Aktion ausgeführt");
    },
    onError: (err) => {
      // err.message trägt die Anzahl fehlgeschlagener Tasks (siehe mutationFn).
      invalidate();
      const n = Number(err instanceof Error ? err.message : "");
      toast.error(
        Number.isFinite(n) && n > 0 ? `${n} Aktion(en) fehlgeschlagen` : "Aktion fehlgeschlagen",
      );
    },
    meta: { silentError: true },
  });

  return { add, update, remove, move, reorder, reindent, createList, bulk };
}
