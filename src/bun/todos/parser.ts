import type { TodoList, TodoTask, TodoPriority } from "../../shared/types";
import { DATE_TOKENS, PRIORITY_TOKENS, RECURRENCE_TOKEN, TAG_RE } from "./tokens";
import { parseRule } from "./recurrence";

// Reiner Parser: Markdown-Inhalt -> TodoList. Pro Task wird die ROH-Zeile und
// ihre Zeilen-Range mitgeführt, damit Mutationen surgical und der Round-Trip
// byte-genau bleiben. Nicht-Task-Zeilen (Frontmatter, Text, Überschriften)
// werden NICHT in tasks aufgenommen, aber Sektionen aus `## ` erkannt.

// Regex für eine Aufgaben-Zeile: optionale Einrückung, "- [ ]" / "- [x]".
const TASK_RE = /^(\s*)-\s\[( |x|X)\]\s?(.*)$/;
// Sektion = "## " oder tiefer (Spec: `## Überschrift`). Eine einzelne `#`-Zeile
// gilt als Datei-Titel, nicht als Sektion.
const SECTION_RE = /^#{2,6}\s+(.*)$/;

export interface RawTask {
  task: TodoTask;
  raw: string; // exakte Originalzeile (ohne Zeilenumbruch)
  lineIndex: number; // 0-basierter Index in den gesplitteten Zeilen
}

export interface ParsedList {
  list: TodoList;
  raw: RawTask[]; // parallele Roh-Info pro Task (gleiche Reihenfolge wie list.tasks)
  lines: string[]; // Originalzeilen (für surgical Mutation)
  trailingNewline: boolean; // endete der Inhalt auf \n?
}

function priorityOf(body: string): TodoPriority {
  for (const emoji of Object.keys(PRIORITY_TOKENS)) {
    if (body.includes(emoji)) return PRIORITY_TOKENS[emoji];
  }
  return "normal";
}

function dateFor(body: string, emoji: string): string | null {
  // Token, dann optionaler Whitespace, dann YYYY-MM-DD.
  const re = new RegExp(`${emoji}\\s*(\\d{4}-\\d{2}-\\d{2})`);
  const m = body.match(re);
  return m ? m[1] : null;
}

function recurrenceOf(body: string): { text: string | null; editable: boolean } {
  const idx = body.indexOf(RECURRENCE_TOKEN);
  if (idx === -1) return { text: null, editable: false };
  // Regeltext bis zum nächsten bekannten Emoji oder #tag bzw. Zeilenende.
  const after = body.slice(idx + RECURRENCE_TOKEN.length);
  const stop = after.search(/[📅🛫⏳➕✅🔺⏫🔼🔽⏬]|#/u);
  const text = (stop === -1 ? after : after.slice(0, stop)).trim();
  return { text: text || null, editable: parseRule(text) !== null };
}

function tagsOf(body: string): string[] {
  const found = body.match(TAG_RE) ?? [];
  return found.map((t) => t.slice(1));
}

function buildTask(
  listId: string,
  section: string | null,
  m: RegExpMatchArray,
  seq: number,
): TodoTask {
  const indent = m[1];
  const body = m[3];
  const rec = recurrenceOf(body);
  return {
    id: `${listId}#${seq}`,
    listId,
    section,
    // Titel = Body ohne Metadaten-Emojis/Tags, getrimmt. Nur für die Anzeige;
    // geschrieben wird immer über die Roh-Zeile, nie über diesen Wert.
    title: stripMeta(body),
    done: m[2].toLowerCase() === "x",
    priority: priorityOf(body),
    due: dateFor(body, "📅"),
    scheduled: dateFor(body, "⏳"),
    start: dateFor(body, "🛫"),
    created: dateFor(body, "➕"),
    doneDate: dateFor(body, "✅"),
    recurrence: rec.text,
    recurrenceEditableInApp: rec.editable,
    tags: tagsOf(body),
    depth: Math.floor(indent.replace(/\t/g, "    ").length / 2),
  };
}

function stripMeta(body: string): string {
  let s = body;
  for (const emoji of Object.keys(DATE_TOKENS)) {
    s = s.replace(new RegExp(`${emoji}\\s*\\d{4}-\\d{2}-\\d{2}`, "g"), "");
  }
  s = s.replace(new RegExp(`${RECURRENCE_TOKEN}[^📅🛫⏳➕✅🔺⏫🔼🔽⏬#]*`, "u"), "");
  for (const emoji of Object.keys(PRIORITY_TOKENS)) s = s.split(emoji).join("");
  s = s.replace(TAG_RE, "");
  return s.replace(/\s+/g, " ").trim();
}

export function parseList(listId: string, name: string, content: string): ParsedList {
  const trailingNewline = content.endsWith("\n");
  const lines = content.split("\n");
  // split() erzeugt bei trailing \n ein leeres letztes Element; entfernen, damit
  // join + (trailingNewline ? "\n" : "") wieder exakt das Original ergibt.
  if (trailingNewline) lines.pop();

  const tasks: TodoTask[] = [];
  const raw: RawTask[] = [];
  const sections: string[] = [];
  let section: string | null = null;
  let seq = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sec = line.match(SECTION_RE);
    if (sec) {
      section = sec[1].trim();
      if (!sections.includes(section)) sections.push(section);
      continue;
    }
    const m = line.match(TASK_RE);
    if (!m) continue;
    const task = buildTask(listId, section, m, seq++);
    tasks.push(task);
    raw.push({ task, raw: line, lineIndex: i });
  }

  return { list: { id: listId, name, tasks, sections }, raw, lines, trailingNewline };
}
