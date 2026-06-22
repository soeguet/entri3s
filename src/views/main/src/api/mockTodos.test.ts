import { describe, it, expect } from "vitest";
import { getTodoLists, addTodoTask, updateTodoTask, deleteTodoTask, createTodoList } from "./mock";

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

  it("deleteTodoTask entfernt den Task", async () => {
    await addTodoTask({ listId: "Privat", title: "Wegwerf" });
    const list = (await getTodoLists()).data!.find((l) => l.id === "Privat")!;
    const target = list.tasks.find((t) => t.title === "Wegwerf")!;
    await deleteTodoTask(target.id, "Privat");
    const after = (await getTodoLists()).data!.find((l) => l.id === "Privat")!;
    expect(after.tasks.some((t) => t.id === target.id)).toBe(false);
  });
});
