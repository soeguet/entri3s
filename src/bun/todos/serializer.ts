import type { TodoTask, TodoTaskCreate, TodoPriority } from "../../shared/types";
import {
  DATE_TOKENS,
  DATE_ORDER,
  PRIORITY_EMOJI,
  PRIORITY_TOKENS,
  RECURRENCE_TOKEN,
  type DateField,
} from "./tokens";

// Surgical Serializer. applyTaskEdit ersetzt NUR die tatsächlich geänderten
// Segmente einer Roh-Zeile (Round-Trip-Pflicht). renderNewTask baut eine neue
// Zeile in definierter Tasks-Plugin-Emoji-Reihenfolge (siehe DATE_ORDER/tokens).

const DATE_EMOJI: Record<DateField, string> = (() => {
  const out = {} as Record<DateField, string>;
  for (const [emoji, field] of Object.entries(DATE_TOKENS)) out[field] = emoji;
  return out;
})();

export interface TaskEdit {
  title?: string;
  done?: boolean;
  priority?: TodoPriority;
  due?: string | null;
  scheduled?: string | null;
  start?: string | null;
  doneDate?: string | null;
  recurrence?: string | null;
}

function setCheckbox(line: string, done: boolean): string {
  return line.replace(/^(\s*-\s)\[( |x|X)\]/, `$1[${done ? "x" : " "}]`);
}

function setDate(line: string, field: DateField, value: string | null): string {
  const emoji = DATE_EMOJI[field];
  const re = new RegExp(`\\s*${emoji}\\s*\\d{4}-\\d{2}-\\d{2}`);
  const stripped = line.replace(re, "");
  if (value === null) return stripped;
  // Token an definierter Stelle anhängen, getrennt durch ein Leerzeichen.
  return `${stripped.replace(/\s+$/, "")} ${emoji} ${value}`;
}

function setPriority(line: string, priority: TodoPriority): string {
  let s = line;
  for (const emoji of Object.keys(PRIORITY_TOKENS)) {
    s = s.replace(new RegExp(`\\s*${emoji}`, "u"), "");
  }
  const emoji = PRIORITY_EMOJI[priority];
  if (!emoji) return s;
  return `${s.replace(/\s+$/, "")} ${emoji}`;
}

function setRecurrence(line: string, text: string | null): string {
  const re = new RegExp(`\\s*${RECURRENCE_TOKEN}[^📅🛫⏳➕✅🔺⏫🔼🔽⏬#]*`, "u");
  const stripped = line.replace(re, "");
  if (text === null) return stripped;
  return `${stripped.replace(/\s+$/, "")} ${RECURRENCE_TOKEN} ${text}`;
}

// Ersetzt den sichtbaren Titel (Text vor dem ersten Metadaten-Emoji/#tag).
function setTitle(line: string, title: string): string {
  const m = line.match(/^(\s*-\s\[(?: |x|X)\]\s?)(.*)$/);
  if (!m) return line;
  const body = m[2];
  const metaIdx = body.search(/[📅🛫⏳➕✅🔺⏫🔼🔽⏬🔁#]|\s#/u);
  const meta = metaIdx === -1 ? "" : body.slice(metaIdx);
  const sep = meta && !meta.startsWith(" ") ? " " : "";
  return `${m[1]}${title.trim()}${sep}${meta}`.replace(/\s+$/, "");
}

export function applyTaskEdit(rawLine: string, edit: TaskEdit): string {
  let line = rawLine;
  if (edit.title !== undefined) line = setTitle(line, edit.title);
  if (edit.priority !== undefined) line = setPriority(line, edit.priority);
  if (edit.recurrence !== undefined) line = setRecurrence(line, edit.recurrence);
  if (edit.start !== undefined) line = setDate(line, "start", edit.start);
  if (edit.scheduled !== undefined) line = setDate(line, "scheduled", edit.scheduled);
  if (edit.due !== undefined) line = setDate(line, "due", edit.due);
  if (edit.doneDate !== undefined) line = setDate(line, "doneDate", edit.doneDate);
  if (edit.done !== undefined) line = setCheckbox(line, edit.done);
  return line;
}

// Baut eine neue Aufgaben-Zeile in definierter Reihenfolge:
// Checkbox, Titel, #tags, Priorität, dann Datumsfelder nach DATE_ORDER.
export function renderNewTask(input: TodoTaskCreate): string {
  let line = `- [ ] ${input.title.trim()}`;
  for (const tag of input.tags ?? []) line += ` #${tag}`;
  if (input.priority && input.priority !== "normal") {
    line += ` ${PRIORITY_EMOJI[input.priority]}`;
  }
  if (input.due) line += ` ${DATE_EMOJI.due} ${input.due}`;
  return line;
}

// Hilfsrenderer für moveTask: rendert eine bestehende TodoTask byte-nah neu,
// falls keine Roh-Zeile verfügbar ist (z.B. listenübergreifend). Nutzt dieselbe
// Reihenfolge wie renderNewTask.
export function renderTask(task: TodoTask): string {
  const indent = "  ".repeat(task.depth);
  let line = `${indent}- [${task.done ? "x" : " "}] ${task.title.trim()}`;
  for (const tag of task.tags) line += ` #${tag}`;
  if (task.priority !== "normal") line += ` ${PRIORITY_EMOJI[task.priority]}`;
  if (task.recurrence) line += ` ${RECURRENCE_TOKEN} ${task.recurrence}`;
  for (const field of DATE_ORDER) {
    const value = task[field];
    if (value) line += ` ${DATE_EMOJI[field]} ${value}`;
  }
  return line;
}
