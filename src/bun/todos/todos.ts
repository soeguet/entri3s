import { accessSync, constants, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import type { TodoList, TodoTaskCreate, TodoTaskPatch } from "../../shared/types";
import type { Repository } from "../repository";
import { appError } from "../lib/app-error";
import { parseList } from "./parser";
import { computeNext, parseRule } from "./recurrence";
import { applyTaskEdit, renderNewTask, renderTask, type TaskEdit } from "./serializer";
import { mutateFile, writeContent } from "./mutate";
import { reorderLines } from "./reorder";
import { fileForList, listMd, read } from "./vault";

// Todo-Service. Liest todoFolder live aus den Settings; TODO_NO_FOLDER wenn der
// Ordner leer/fehlt/nicht schreibbar ist. Alle Mutationen laufen über mutate.ts
// (detect-before-write, fail-closed). Datums-/Recurrence-Logik liegt rein in
// recurrence.ts.

function todayBerlinYmd(): string {
  // Recurrence "when done" verankert am heutigen Datum. Europe/Berlin, da der
  // Nutzer in dieser Zone arbeitet (Spec: TZ nur außerhalb von SQLite).
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function createTodoService(repo: Repository) {
  function folder(): string {
    const dir = repo.settings.getAll().todoFolder.trim();
    if (!dir) throw appError("TODO_NO_FOLDER", "Kein Todo-Ordner konfiguriert.", false);
    // Ordner automatisch anlegen, aber NUR wenn der übergeordnete Ordner schon
    // existiert. So vermeidet ein Tippfehler im Pfad (z.B. falsches Laufwerk)
    // das versehentliche Anlegen eines tiefen, ungewollten Verzeichnisbaums.
    if (!existsSync(dir)) {
      const parent = dirname(dir);
      if (!existsSync(parent) || !statSync(parent).isDirectory()) {
        throw appError(
          "TODO_NO_FOLDER",
          "Übergeordneter Ordner existiert nicht – bitte Pfad prüfen.",
          false,
        );
      }
      mkdirSync(dir, { recursive: true });
    }
    if (!statSync(dir).isDirectory()) {
      throw appError("TODO_NO_FOLDER", "Todo-Ordner existiert nicht.", false);
    }
    try {
      accessSync(dir, constants.W_OK);
    } catch {
      throw appError("TODO_NO_FOLDER", "Todo-Ordner ist nicht schreibbar.", false);
    }
    return dir;
  }

  async function loadList(dir: string, name: string): Promise<TodoList> {
    const file = fileForList(dir, name);
    const r = await read(file);
    return parseList(name, name, r.content).list;
  }

  // Fingerprint (Roh-Zeile) eines Tasks holen — frisch aus der Datei, damit die
  // flüchtige id nur zum Auffinden, nie als Wahrheit dient.
  async function fingerprintOf(dir: string, listId: string, taskId: string): Promise<string> {
    const file = fileForList(dir, listId);
    const r = await read(file);
    const parsed = parseList(listId, listId, r.content);
    const hit = parsed.raw.find((x) => x.task.id === taskId);
    if (!hit) throw appError("TODO_CONFLICT", "Aufgabe nicht gefunden.", false);
    return hit.raw;
  }

  return {
    async getLists(): Promise<TodoList[]> {
      const dir = folder();
      // "Inbox" anlegen, damit immer eine nutzbare Liste existiert (Todoist-
      // Modell). Bewusst auch dann, wenn der Nutzer alle Listen gelöscht hat:
      // ein leerer Todo-Ordner soll nie ohne Einstiegsliste dastehen.
      if (listMd(dir).length === 0) {
        writeContent(fileForList(dir, "Inbox"), "");
      }
      const names = listMd(dir).sort((a, b) => a.localeCompare(b));
      return Promise.all(names.map((n) => loadList(dir, n)));
    },

    async getList(name: string): Promise<TodoList> {
      return loadList(folder(), name);
    },

    createList(name: string): void {
      const dir = folder();
      const file = fileForList(dir, name);
      if (existsSync(file)) {
        throw appError("TODO_CONFLICT", "Liste existiert bereits.", false);
      }
      writeContent(file, "");
    },

    async addTask(input: TodoTaskCreate): Promise<void> {
      const dir = folder();
      const file = fileForList(dir, input.listId);
      const r = await read(file);
      const line = renderNewTask(input);
      // Section-Insert: nach der passenden Überschrift, sonst ans Ende.
      const lines = r.content.length ? r.content.replace(/\n$/, "").split("\n") : [];
      if (input.section) insertUnderSection(lines, input.section, line);
      else lines.push(line);
      writeContent(file, lines.join("\n") + "\n");
    },

    async updateTask(patch: TodoTaskPatch): Promise<void> {
      const dir = folder();
      const file = fileForList(dir, patch.listId);
      const fingerprint = await fingerprintOf(dir, patch.listId, patch.id);
      await mutateFile(patch.listId, file, fingerprint, (parsed, idx) => {
        return applyUpdate(parsed.lines, idx, patch);
      });
    },

    async deleteTask(id: string, listId: string): Promise<void> {
      const dir = folder();
      const file = fileForList(dir, listId);
      const fingerprint = await fingerprintOf(dir, listId, id);
      await mutateFile(listId, file, fingerprint, (parsed, idx) => {
        const lines = [...parsed.lines];
        lines.splice(idx, 1);
        return lines;
      });
    },

    // Move = erst Ziel schreiben, dann Quelle entfernen (siehe Spec). Bei Fehler
    // im zweiten Schritt existiert die Aufgabe doppelt statt verloren zu gehen.
    async moveTask(
      id: string,
      fromList: string,
      toList: string,
      toSection: string | null,
    ): Promise<void> {
      const dir = folder();
      const srcFile = fileForList(dir, fromList);
      const src = await read(srcFile);
      const parsed = parseList(fromList, fromList, src.content);
      const hit = parsed.raw.find((x) => x.task.id === id);
      if (!hit) throw appError("TODO_CONFLICT", "Aufgabe nicht gefunden.", false);

      const moved = { ...hit.task, listId: toList, section: toSection ?? null };
      const destFile = fileForList(dir, toList);
      const destRead = await read(destFile);
      const destLines = destRead.content.length
        ? destRead.content.replace(/\n$/, "").split("\n")
        : [];
      const newLine = renderTask({ ...moved, depth: 0 });
      if (toSection) insertUnderSection(destLines, toSection, newLine);
      else destLines.push(newLine);
      writeContent(destFile, destLines.join("\n") + "\n");

      await mutateFile(fromList, srcFile, hit.raw, (p, idx) => {
        const lines = [...p.lines];
        lines.splice(idx, 1);
        return lines;
      });
    },

    // Umsortieren INNERHALB einer Liste (Drag&Drop). Der verschobene Task nimmt
    // seinen Subtask-Block mit. ids dienen nur zum Auffinden; die Verschiebung
    // selbst läuft fingerprint-basiert und fail-closed in reorderLines.
    async reorderTask(
      listId: string,
      id: string,
      targetId: string,
      before: boolean,
    ): Promise<void> {
      const dir = folder();
      const file = fileForList(dir, listId);
      const r = await read(file);
      const parsed = parseList(listId, listId, r.content);
      const moved = parsed.raw.find((x) => x.task.id === id);
      const target = parsed.raw.find((x) => x.task.id === targetId);
      if (!moved || !target) throw appError("TODO_CONFLICT", "Aufgabe nicht gefunden.", false);
      const next = reorderLines(r.content, moved.raw, target.raw, before);
      writeContent(file, next);
    },

    // Saved Filters: schema-agnostisch als opaker JSON-String in den Settings
    // abgelegt (Muster wie Template.payload). Der Inhalt gehört dem Frontend.
    getSavedFilters(): string {
      return repo.settings.get("todoSavedFilters") ?? "";
    },
    setSavedFilters(json: string): void {
      repo.settings.set("todoSavedFilters", json);
    },
  };
}

// Erzeugt die neuen Zeilen für ein Update an Zeilen-Index idx. Behandelt das
// Abhaken eines wiederkehrenden Tasks: alte Instanz wird erledigt (✅ heute),
// eine neue offene Instanz mit nächster Fälligkeit wird direkt darunter angelegt.
function applyUpdate(srcLines: string[], idx: number, patch: TodoTaskPatch): string[] {
  const lines = [...srcLines];
  const original = lines[idx];
  const edit: TaskEdit = {
    title: patch.title,
    priority: patch.priority,
    due: patch.due,
    scheduled: patch.scheduled,
    start: patch.start,
  };

  const turningDone = patch.done === true;
  const today = todayBerlinYmd();
  if (turningDone) {
    edit.done = true;
    edit.doneDate = today;
  } else if (patch.done === false) {
    edit.done = false;
    edit.doneDate = null;
  }

  lines[idx] = applyTaskEdit(original, edit);

  // Recurrence: nur beim Abhaken und nur bei in-app editierbaren Regeln.
  if (turningDone) {
    const parsedTask = parseSingle(original);
    const rule = parseRule(parsedTask.recurrence);
    if (rule) {
      const base = parsedTask.due ?? parsedTask.scheduled ?? null;
      const next = computeNext(rule, base, today);
      if (next) {
        const nextEdit: TaskEdit = { done: false, doneDate: null };
        if (parsedTask.due) nextEdit.due = next;
        else if (parsedTask.scheduled) nextEdit.scheduled = next;
        else nextEdit.due = next;
        lines.splice(idx, 0, applyTaskEdit(original, nextEdit));
      }
    }
  }
  return lines;
}

// Minimaler Single-Line-Parse über den vollen Parser (eine Zeile).
function parseSingle(line: string) {
  return parseList("_", "_", line).list.tasks[0];
}

function insertUnderSection(lines: string[], section: string, newLine: string): void {
  const re = new RegExp(`^#{1,6}\\s+${escapeRe(section)}\\s*$`);
  const headerIdx = lines.findIndex((l) => re.test(l));
  if (headerIdx === -1) {
    // Section fehlt -> Überschrift + Zeile am Ende anlegen.
    lines.push(`## ${section}`, newLine);
    return;
  }
  // Direkt nach der letzten Zeile dieser Section einfügen (vor nächster ##).
  let insertAt = lines.length;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (/^#{1,6}\s+/.test(lines[i])) {
      insertAt = i;
      break;
    }
  }
  lines.splice(insertAt, 0, newLine);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type TodoService = ReturnType<typeof createTodoService>;
