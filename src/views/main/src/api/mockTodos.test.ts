import { describe, it, expect } from "vitest";
import {
  getTodoLists,
  addTodoTask,
  updateTodoTask,
  deleteTodoTask,
  createTodoList,
  reorderTodoTask,
  reindentTodoTask,
} from "./mock";

// Mock-Parität für das Todo-Modul. Wichtig u.a. für die Konflikt-UX: der Mock
// MUSS den TODO_CONFLICT-Pfad auslösen können (Titel-Präfix "CONFLICT").
describe("mock todos", () => {
  it("getTodoLists liefert die Listen aus den Fixtures", async () => {
    const res = await getTodoLists();
    expect(res.error).toBeNull();
    expect((res.data ?? []).some((l) => l.id === "Arbeit")).toBe(true);
  });

  it("addTodoTask hängt einen Task an die Liste", async () => {
    const before = (await getTodoLists()).data ?? [];
    const count = before.find((l) => l.id === "Arbeit")!.tasks.length;
    await addTodoTask({ listId: "Arbeit", title: "Frischer Task" });
    const after = (await getTodoLists()).data ?? [];
    expect(after.find((l) => l.id === "Arbeit")!.tasks.length).toBe(count + 1);
  });

  it("updateTodoTask mit CONFLICT-Präfix liefert TODO_CONFLICT", async () => {
    await addTodoTask({ listId: "Arbeit", title: "CONFLICT extern geändert" });
    const list = (await getTodoLists()).data!.find((l) => l.id === "Arbeit")!;
    const conflicting = list.tasks.find((t) => t.title.startsWith("CONFLICT"))!;
    const res = await updateTodoTask({ id: conflicting.id, listId: "Arbeit", done: true });
    expect(res.error?.code).toBe("TODO_CONFLICT");
  });

  it("createTodoList lehnt ungültige Namen mit INVALID_NAME ab", async () => {
    expect((await createTodoList("a/b")).error?.code).toBe("INVALID_NAME");
    expect((await createTodoList("")).error?.code).toBe("INVALID_NAME");
  });

  it("reorderTodoTask sortiert den Task vor das Ziel (before=true)", async () => {
    await createTodoList("ReorderA");
    await addTodoTask({ listId: "ReorderA", title: "Task-1" });
    await addTodoTask({ listId: "ReorderA", title: "Task-2" });
    await addTodoTask({ listId: "ReorderA", title: "Task-3" });
    const before = (await getTodoLists()).data!.find((l) => l.id === "ReorderA")!;
    const t3 = before.tasks.find((t) => t.title === "Task-3")!;
    const t1 = before.tasks.find((t) => t.title === "Task-1")!;
    await reorderTodoTask("ReorderA", t3.id, t1.id, true);
    const after = (await getTodoLists()).data!.find((l) => l.id === "ReorderA")!;
    expect(after.tasks.map((t) => t.title)).toEqual(["Task-3", "Task-1", "Task-2"]);
  });

  it("reorderTodoTask sortiert den Task hinter das Ziel (before=false)", async () => {
    await createTodoList("ReorderB");
    await addTodoTask({ listId: "ReorderB", title: "B-1" });
    await addTodoTask({ listId: "ReorderB", title: "B-2" });
    await addTodoTask({ listId: "ReorderB", title: "B-3" });
    const before = (await getTodoLists()).data!.find((l) => l.id === "ReorderB")!;
    const b1 = before.tasks.find((t) => t.title === "B-1")!;
    const b3 = before.tasks.find((t) => t.title === "B-3")!;
    await reorderTodoTask("ReorderB", b1.id, b3.id, false);
    const after = (await getTodoLists()).data!.find((l) => l.id === "ReorderB")!;
    expect(after.tasks.map((t) => t.title)).toEqual(["B-2", "B-3", "B-1"]);
  });

  it("reindentTodoTask rückt einen Task unter den vorangehenden ein (depth +1)", async () => {
    await createTodoList("IndentA");
    await addTodoTask({ listId: "IndentA", title: "I-parent" });
    await addTodoTask({ listId: "IndentA", title: "I-child" });
    const before = (await getTodoLists()).data!.find((l) => l.id === "IndentA")!;
    const child = before.tasks.find((t) => t.title === "I-child")!;
    expect(child.depth).toBe(0);
    const res = await reindentTodoTask("IndentA", child.id, "indent");
    expect(res.error).toBeNull();
    const after = (await getTodoLists()).data!.find((l) => l.id === "IndentA")!;
    expect(after.tasks.find((t) => t.title === "I-child")!.depth).toBe(1);
  });

  it("reindentTodoTask hebt einen Subtask heraus (depth -1) — Round-Trip", async () => {
    await createTodoList("OutdentA");
    await addTodoTask({ listId: "OutdentA", title: "O-parent" });
    await addTodoTask({ listId: "OutdentA", title: "O-child" });
    const list = (await getTodoLists()).data!.find((l) => l.id === "OutdentA")!;
    const child = list.tasks.find((t) => t.title === "O-child")!;
    await reindentTodoTask("OutdentA", child.id, "indent");
    await reindentTodoTask("OutdentA", child.id, "outdent");
    const after = (await getTodoLists()).data!.find((l) => l.id === "OutdentA")!;
    expect(after.tasks.find((t) => t.title === "O-child")!.depth).toBe(0);
  });

  it("reindentTodoTask outdent eines Tiefe-0-Tasks liefert TODO_REINDENT", async () => {
    await createTodoList("OutdentB");
    await addTodoTask({ listId: "OutdentB", title: "top" });
    const list = (await getTodoLists()).data!.find((l) => l.id === "OutdentB")!;
    const top = list.tasks.find((t) => t.title === "top")!;
    const res = await reindentTodoTask("OutdentB", top.id, "outdent");
    expect(res.error?.code).toBe("TODO_REINDENT");
  });

  it("reindentTodoTask indent des ersten Tasks liefert TODO_REINDENT", async () => {
    await createTodoList("IndentB");
    await addTodoTask({ listId: "IndentB", title: "first" });
    const list = (await getTodoLists()).data!.find((l) => l.id === "IndentB")!;
    const first = list.tasks.find((t) => t.title === "first")!;
    const res = await reindentTodoTask("IndentB", first.id, "indent");
    expect(res.error?.code).toBe("TODO_REINDENT");
  });

  it("deleteTodoTask entfernt den Task", async () => {
    await addTodoTask({ listId: "Privat", title: "Wegwerf" });
    const list = (await getTodoLists()).data!.find((l) => l.id === "Privat")!;
    const target = list.tasks.find((t) => t.title === "Wegwerf")!;
    await deleteTodoTask(target.id, "Privat");
    const after = (await getTodoLists()).data!.find((l) => l.id === "Privat")!;
    expect(after.tasks.some((t) => t.id === target.id)).toBe(false);
  });
});
