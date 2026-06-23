import type { TodoPriority } from "../../../../../shared/types";
import { reschedulePresetDate, nextWeekdayYmd, shiftDay } from "../../lib/dates";

export interface ParsedQuickAdd {
  title: string;
  due: string | null;
  tags: string[];
  priority: TodoPriority;
}

interface Range {
  start: number;
  end: number;
}

// Wort-Grenzen über Lookarounds statt \b: \b ist mit Umlauten (ü, ä …) in JS
// unzuverlässig. So matchen "morgen" nicht über "mo" und "dienstag" nicht über "di".
const BOUNDARY_BEFORE = "(?<![\\p{L}\\p{N}_])";
const BOUNDARY_AFTER = "(?![\\p{L}\\p{N}_])";

function wholeWord(body: string): RegExp {
  return new RegExp(BOUNDARY_BEFORE + body + BOUNDARY_AFTER, "giu");
}

const PRIORITY_TOKENS: Record<string, TodoPriority> = {
  p1: "highest",
  p2: "high",
  p3: "medium",
  p4: "low",
};

// ISO 1=Mo .. 7=So für lange und kurze Wochentagsformen.
// Alle Datums-Tokens werden nur noch mit "@"-Präfix erkannt (siehe findDate),
// daher ist die Kurzform "so" für Sonntag unproblematisch: "@so" kollidiert
// nicht mehr mit dem bloßen deutschen Wort "so" im Titel.
const WEEKDAY_DOW: Record<string, number> = {
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
  sonntag: 7,
  mo: 1,
  di: 2,
  mi: 3,
  do: 4,
  fr: 5,
  sa: 6,
  so: 7,
};

/** Erste Priorität (p1..p4) als ganzes Wort; gibt Wert + Bereich zurück. */
function findPriority(raw: string): { priority: TodoPriority; range: Range } | null {
  let best: { priority: TodoPriority; range: Range } | null = null;
  for (const token of Object.keys(PRIORITY_TOKENS)) {
    const m = wholeWord(token).exec(raw);
    if (m && (!best || m.index < best.range.start)) {
      best = {
        priority: PRIORITY_TOKENS[token],
        range: { start: m.index, end: m.index + m[0].length },
      };
    }
  }
  return best;
}

/** Alle #tags als ganze Wörter; liefert dedup-Liste + alle zu entfernenden Bereiche. */
function findTags(raw: string): { tags: string[]; ranges: Range[] } {
  const re = new RegExp("#([\\p{L}\\p{N}_-]+)", "gu");
  const tags: string[] = [];
  const ranges: Range[] = [];
  for (let m = re.exec(raw); m !== null; m = re.exec(raw)) {
    const tag = m[1];
    if (!tags.includes(tag)) tags.push(tag);
    ranges.push({ start: m.index, end: m.index + m[0].length });
  }
  return { tags, ranges };
}

interface DateHit {
  due: string;
  range: Range;
}

/**
 * Datums-Token mit "@"-Präfix als ganzes Wort. Das "@" gehört zum Match (und
 * wird damit aus dem Titel entfernt). Vor dem "@" muss eine Wortgrenze liegen,
 * nach dem Token-Body ebenfalls, damit z.B. "@morgen" nicht über "@mo" matcht.
 */
function atWord(body: string): RegExp {
  return new RegExp(BOUNDARY_BEFORE + "@" + body + BOUNDARY_AFTER, "giu");
}

/** Erstes (kleinster Index) erkanntes "@"-Datum. */
function findDate(raw: string, today: string): DateHit | null {
  const hits: DateHit[] = [];

  const push = (due: string, index: number, length: number) =>
    hits.push({ due, range: { start: index, end: index + length } });

  const keyword = (word: string, due: string) => {
    const m = atWord(word).exec(raw);
    if (m) push(due, m.index, m[0].length);
  };

  keyword("heute", today);
  keyword("morgen", reschedulePresetDate("tomorrow", today));
  keyword("übermorgen", shiftDay(today, 2));
  keyword("wochenende", reschedulePresetDate("weekend", today));

  // "@nächste woche" / "@naechste woche" (Whitespace flexibel).
  const nextWeek = atWord("n(?:ä|ae)chste\\s+woche").exec(raw);
  if (nextWeek) {
    push(reschedulePresetDate("nextWeek", today), nextWeek.index, nextWeek[0].length);
  }

  for (const word of Object.keys(WEEKDAY_DOW)) {
    const m = atWord(word).exec(raw);
    if (m) push(nextWeekdayYmd(today, WEEKDAY_DOW[word]), m.index, m[0].length);
  }

  findExplicitDates(raw, today, push);

  if (hits.length === 0) return null;
  return hits.reduce((a, b) => (b.range.start < a.range.start ? b : a));
}

/**
 * Explizite Datumsangaben mit "@"-Präfix: @d.m. / @d.m.yyyy und ISO @yyyy-mm-dd.
 * Das "@" gehört zum Match und wird mit entfernt.
 * Fehlt das Jahr, wird bewusst das aktuelle Jahr aus `today` genommen und es
 * gibt KEINEN Roll-over ins Folgejahr (Phase 1, absichtlich simpel gehalten).
 */
function findExplicitDates(
  raw: string,
  today: string,
  push: (due: string, index: number, length: number) => void,
): void {
  const currentYear = today.slice(0, 4);
  const pad = (s: string) => s.padStart(2, "0");

  const german = new RegExp(
    BOUNDARY_BEFORE + "@(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})?" + BOUNDARY_AFTER,
    "gu",
  );
  for (let m = german.exec(raw); m !== null; m = german.exec(raw)) {
    const year = m[3] ?? currentYear;
    push(`${year}-${pad(m[2])}-${pad(m[1])}`, m.index, m[0].length);
  }

  const iso = new RegExp(BOUNDARY_BEFORE + "@(\\d{4})-(\\d{2})-(\\d{2})" + BOUNDARY_AFTER, "gu");
  for (let m = iso.exec(raw); m !== null; m = iso.exec(raw)) {
    push(`${m[1]}-${m[2]}-${m[3]}`, m.index, m[0].length);
  }
}

/** Entfernt Bereiche von hinten nach vorne, damit Indizes stabil bleiben. */
function removeRanges(raw: string, ranges: Range[]): string {
  const sorted = [...ranges].sort((a, b) => b.start - a.start);
  let result = raw;
  for (const r of sorted) {
    result = result.slice(0, r.start) + result.slice(r.end);
  }
  return result;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function parseQuickAdd(raw: string, today: string): ParsedQuickAdd {
  const priority = findPriority(raw);
  const { tags, ranges: tagRanges } = findTags(raw);
  const date = findDate(raw, today);

  const ranges: Range[] = [...tagRanges];
  if (priority) ranges.push(priority.range);
  if (date) ranges.push(date.range);

  const title = normalizeWhitespace(removeRanges(raw, ranges));

  // Schutzregel: Bleibt nach dem Parsen kein Titel übrig (z. B. nur "p1"),
  // wird der Rohtext als Titel verwendet und keine Tokens angewendet.
  if (title.length === 0) {
    return { title: raw.trim(), due: null, tags: [], priority: "normal" };
  }

  return {
    title,
    due: date?.due ?? null,
    tags,
    priority: priority?.priority ?? "normal",
  };
}
