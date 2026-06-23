import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestDb } from "../repository/test-helper";
import { createRepository, type Repository } from "../repository";
import { createTodoService, type TodoService } from "./todos";

let dir: string;
let repo: Repository;
let svc: TodoService;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "todos-svc-"));
  repo = createRepository(createTestDb());
  repo.settings.set("todoFolder", dir);
  svc = createTodoService(repo);
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("TODO_NO_FOLDER when folder not configured", async () => {
  repo.settings.set("todoFolder", "");
  await expect(svc.getLists()).rejects.toMatchObject({ code: "TODO_NO_FOLDER" });
});

test("getLists seeds an Inbox list when the folder is empty", async () => {
  const lists = await svc.getLists();
  expect(lists.map((l) => l.name)).toEqual(["Inbox"]);
  expect(existsSync(join(dir, "Inbox.md"))).toBe(true);
});

test("getLists auto-creates the folder when it is missing but parent exists", async () => {
  const sub = join(dir, "vault");
  expect(existsSync(sub)).toBe(false);
  repo.settings.set("todoFolder", sub);
  const lists = await svc.getLists();
  expect(existsSync(sub)).toBe(true);
  expect(lists.map((l) => l.name)).toEqual(["Inbox"]);
});

test("TODO_NO_FOLDER when parent of the folder does not exist", async () => {
  const deep = join(dir, "nope", "vault");
  repo.settings.set("todoFolder", deep);
  await expect(svc.getLists()).rejects.toMatchObject({ code: "TODO_NO_FOLDER" });
  expect(existsSync(deep)).toBe(false);
  expect(existsSync(join(dir, "nope"))).toBe(false);
});

test("getLists parses files in folder", async () => {
  writeFileSync(join(dir, "Inbox.md"), "- [ ] hello\n");
  const lists = await svc.getLists();
  expect(lists.map((l) => l.name)).toEqual(["Inbox"]);
  expect(lists[0].tasks[0].title).toBe("hello");
});

test("createList creates an empty file; duplicate -> TODO_CONFLICT", () => {
  svc.createList("Work");
  expect(readFileSync(join(dir, "Work.md"), "utf8")).toBe("");
  expect(() => svc.createList("Work")).toThrow();
});

test("addTask appends a rendered line", async () => {
  writeFileSync(join(dir, "Inbox.md"), "- [ ] existing\n");
  await svc.addTask({ listId: "Inbox", title: "new task", due: "2026-06-30" });
  expect(readFileSync(join(dir, "Inbox.md"), "utf8")).toBe(
    "- [ ] existing\n- [ ] new task 📅 2026-06-30\n",
  );
});

test("addTask with parentId inserts an indented subtask after the parent", async () => {
  writeFileSync(join(dir, "Inbox.md"), "- [ ] parent\n- [ ] sibling\n");
  const list = await svc.getList("Inbox");
  const parent = list.tasks.find((t) => t.title === "parent")!;
  await svc.addTask({ listId: "Inbox", title: "child", parentId: parent.id });
  expect(readFileSync(join(dir, "Inbox.md"), "utf8")).toBe(
    "- [ ] parent\n  - [ ] child\n- [ ] sibling\n",
  );
  const reloaded = await svc.getList("Inbox");
  const parentNow = reloaded.tasks.find((t) => t.title === "parent")!;
  const child = reloaded.tasks.find((t) => t.title === "child")!;
  expect(child.depth).toBe(parentNow.depth + 1);
});

test("addTask with parentId appends after existing subtasks", async () => {
  writeFileSync(join(dir, "Inbox.md"), "- [ ] parent\n  - [ ] first\n- [ ] sibling\n");
  const list = await svc.getList("Inbox");
  const parent = list.tasks.find((t) => t.title === "parent")!;
  await svc.addTask({ listId: "Inbox", title: "second", parentId: parent.id });
  expect(readFileSync(join(dir, "Inbox.md"), "utf8")).toBe(
    "- [ ] parent\n  - [ ] first\n  - [ ] second\n- [ ] sibling\n",
  );
});

test("addTask with unknown parentId -> TODO_CONFLICT", async () => {
  writeFileSync(join(dir, "Inbox.md"), "- [ ] parent\n");
  await expect(
    svc.addTask({ listId: "Inbox", title: "child", parentId: "Inbox#999" }),
  ).rejects.toMatchObject({ code: "TODO_CONFLICT" });
  expect(readFileSync(join(dir, "Inbox.md"), "utf8")).toBe("- [ ] parent\n");
});

test("updateTask with tags writes them into the file", async () => {
  writeFileSync(join(dir, "Inbox.md"), "- [ ] task #old\n");
  const list = await svc.getList("Inbox");
  await svc.updateTask({ id: list.tasks[0].id, listId: "Inbox", tags: ["new", "fresh"] });
  expect(readFileSync(join(dir, "Inbox.md"), "utf8")).toBe("- [ ] task #new #fresh\n");
});

test("updateTask toggling done adds ✅ doneDate", async () => {
  writeFileSync(join(dir, "Inbox.md"), "- [ ] task\n");
  const list = await svc.getList("Inbox");
  await svc.updateTask({ id: list.tasks[0].id, listId: "Inbox", done: true });
  const out = readFileSync(join(dir, "Inbox.md"), "utf8");
  expect(out).toMatch(/^- \[x\] task ✅ \d{4}-\d{2}-\d{2}\n$/);
});

test("completing a recurring task creates next open instance", async () => {
  writeFileSync(join(dir, "Inbox.md"), "- [ ] standup 🔁 every day 📅 2026-06-22\n");
  const list = await svc.getList("Inbox");
  await svc.updateTask({ id: list.tasks[0].id, listId: "Inbox", done: true });
  const out = readFileSync(join(dir, "Inbox.md"), "utf8");
  const lines = out.trimEnd().split("\n");
  expect(lines).toHaveLength(2);
  // Erste Zeile = neue offene Instanz mit nächster Fälligkeit.
  expect(lines[0]).toContain("- [ ]");
  expect(lines[0]).toContain("📅 2026-06-23");
  // Zweite Zeile = abgehakte alte Instanz mit ✅.
  expect(lines[1]).toContain("- [x]");
  expect(lines[1]).toContain("✅");
});

test("updateTask sets a new multi-line description below the task", async () => {
  writeFileSync(join(dir, "Inbox.md"), "- [ ] task\n- [ ] other\n");
  const list = await svc.getList("Inbox");
  const t = list.tasks.find((x) => x.title === "task")!;
  await svc.updateTask({ id: t.id, listId: "Inbox", description: "line a\nline b" });
  expect(readFileSync(join(dir, "Inbox.md"), "utf8")).toBe(
    "- [ ] task\n  line a\n  line b\n- [ ] other\n",
  );
});

test("updateTask changes an existing description, leaving other tasks byte-exact", async () => {
  writeFileSync(join(dir, "Inbox.md"), "- [ ] task\n  old note\n- [ ] other #tag\n");
  const list = await svc.getList("Inbox");
  const t = list.tasks.find((x) => x.title === "task")!;
  await svc.updateTask({ id: t.id, listId: "Inbox", description: "new note\nsecond" });
  expect(readFileSync(join(dir, "Inbox.md"), "utf8")).toBe(
    "- [ ] task\n  new note\n  second\n- [ ] other #tag\n",
  );
});

test("updateTask removes a description when set to null", async () => {
  writeFileSync(join(dir, "Inbox.md"), "- [ ] task\n  note one\n  note two\n- [ ] other\n");
  const list = await svc.getList("Inbox");
  const t = list.tasks.find((x) => x.title === "task")!;
  await svc.updateTask({ id: t.id, listId: "Inbox", description: null });
  expect(readFileSync(join(dir, "Inbox.md"), "utf8")).toBe("- [ ] task\n- [ ] other\n");
});

test("updateTask leaves description untouched when patch.description is absent", async () => {
  writeFileSync(join(dir, "Inbox.md"), "- [ ] task #old\n  keep this note\n");
  const list = await svc.getList("Inbox");
  const t = list.tasks.find((x) => x.title === "task")!;
  await svc.updateTask({ id: t.id, listId: "Inbox", tags: ["new"] });
  expect(readFileSync(join(dir, "Inbox.md"), "utf8")).toBe("- [ ] task #new\n  keep this note\n");
});

test("updateTask indents description under a subtask (deeper task)", async () => {
  writeFileSync(join(dir, "Inbox.md"), "- [ ] parent\n  - [ ] child\n");
  const list = await svc.getList("Inbox");
  const child = list.tasks.find((x) => x.title === "child")!;
  await svc.updateTask({ id: child.id, listId: "Inbox", description: "child note" });
  expect(readFileSync(join(dir, "Inbox.md"), "utf8")).toBe(
    "- [ ] parent\n  - [ ] child\n    child note\n",
  );
});

test("deleteTask removes the line", async () => {
  writeFileSync(join(dir, "Inbox.md"), "- [ ] a\n- [ ] b\n");
  const list = await svc.getList("Inbox");
  const b = list.tasks.find((t) => t.title === "b")!;
  await svc.deleteTask(b.id, "Inbox");
  expect(readFileSync(join(dir, "Inbox.md"), "utf8")).toBe("- [ ] a\n");
});

test("saved filters: empty initially, round-trips the same string", () => {
  expect(svc.getSavedFilters()).toBe("");
  const json = '[{"id":"a","name":"Wichtig"}]';
  svc.setSavedFilters(json);
  expect(svc.getSavedFilters()).toBe(json);
});

test("moveTask writes destination first then removes source", async () => {
  writeFileSync(join(dir, "Inbox.md"), "- [ ] move me\n- [ ] stay\n");
  writeFileSync(join(dir, "Done.md"), "");
  const list = await svc.getList("Inbox");
  const t = list.tasks.find((x) => x.title === "move me")!;
  await svc.moveTask(t.id, "Inbox", "Done", null);
  expect(readFileSync(join(dir, "Inbox.md"), "utf8")).toBe("- [ ] stay\n");
  expect(readFileSync(join(dir, "Done.md"), "utf8")).toContain("move me");
});

test("reindentTask indents a task (and its subtree) one level deeper", async () => {
  writeFileSync(join(dir, "Inbox.md"), "- [ ] parent\n- [ ] child\n  note\n");
  const list = await svc.getList("Inbox");
  const child = list.tasks.find((x) => x.title === "child")!;
  await svc.reindentTask("Inbox", child.id, "indent");
  expect(readFileSync(join(dir, "Inbox.md"), "utf8")).toBe(
    "- [ ] parent\n  - [ ] child\n    note\n",
  );
});

test("reindentTask outdents a task (and its subtree) one level up", async () => {
  writeFileSync(join(dir, "Inbox.md"), "- [ ] parent\n  - [ ] child\n    note\n");
  const list = await svc.getList("Inbox");
  const child = list.tasks.find((x) => x.title === "child")!;
  await svc.reindentTask("Inbox", child.id, "outdent");
  expect(readFileSync(join(dir, "Inbox.md"), "utf8")).toBe("- [ ] parent\n- [ ] child\n  note\n");
});
