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
  // Zeilen-Range [start, end) der zur Task gehörenden Beschreibungs-Zeilen.
  // Ohne Beschreibung: start === end === lineIndex + 1 (Einfügepunkt direkt
  // unter der Task-Zeile). Wird für surgical Description-Mutation gebraucht.
  descRange: { start: number; end: number };
}

export interface ParsedList {
  list: TodoList;
  raw: RawTask[]; // parallele Roh-Info pro Task (gleiche Reihenfolge wie list.tasks)
  lines: string[]; // Originalzeilen (für surgical Mutation)
  trailingNewline: boolean; // endete der Inhalt auf \n?
}

// Normalisierte Einrückungs-Breite einer Zeile: führender Whitespace, Tabs als
// 4 Spaces gezählt (gleiche Normalisierung wie buildTask.depth). Gemeinsame
// Basis für depth, Description-Erkennung und blockRange-Subtree-Semantik.
export function indentWidth(line: string): number {
  const lead = line.match(/^[ \t]*/)?.[0] ?? "";
  return lead.replace(/\t/g, "    ").length;
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
    // description wird im parseList-Loop nachgetragen (braucht die Folgezeilen).
    description: null,
  };
}

// Beschreibungs-Konvention: die unmittelbar auf die Task-Zeile folgenden Zeilen,
// die ALLE gelten: (1) stärker eingerückt als die Task-Zeile, (2) keine Task-
// Zeile, (3) kein Section-Header, (4) nicht leer. Der Block endet bei der ersten
// Verletzung (Subtask, gleich/weniger eingerückt, Section, Leerzeile, EOF).
// Damit steht die Beschreibung IMMER direkt unter der Task-Zeile und vor etwaigen
// Subtasks (natürliche Obsidian-Layout-Annahme).
function descriptionEnd(lines: string[], taskLineIndex: number, taskIndent: number): number {
  let end = taskLineIndex + 1;
  while (end < lines.length) {
    const line = lines[end];
    if (line.trim() === "") break;
    if (TASK_RE.test(line)) break;
    if (SECTION_RE.test(line)) break;
    if (indentWidth(line) <= taskIndent) break;
    end++;
  }
  return end;
}

// Dedented Beschreibungstext: pro Zeile die (taskIndent + 2)-Spaces-Einrückung
// entfernen (bzw. so viel führenden Whitespace wie vorhanden), Zeilen mit "\n"
// verbinden. Tabs werden für die Längenberechnung als 4 Spaces gezählt.
function dedentDescription(lines: string[], taskIndent: number): string {
  const strip = taskIndent + 2;
  return lines
    .map((line) => {
      let removed = 0;
      let i = 0;
      while (i < line.length && removed < strip) {
        const ch = line[i];
        if (ch === " ") removed += 1;
        else if (ch === "\t") removed += 4;
        else break;
        i++;
      }
      return line.slice(i);
    })
    .join("\n");
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
    const taskIndent = indentWidth(line);
    const descStart = i + 1;
    const descEnd = descriptionEnd(lines, i, taskIndent);
    if (descEnd > descStart) {
      task.description = dedentDescription(lines.slice(descStart, descEnd), taskIndent);
    }
    tasks.push(task);
    raw.push({ task, raw: line, lineIndex: i, descRange: { start: descStart, end: descEnd } });
  }

  return { list: { id: listId, name, tasks, sections }, raw, lines, trailingNewline };
}
