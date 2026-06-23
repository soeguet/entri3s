import type { TodoPriority } from "../../shared/types";

// Geteilte Emoji<->Feld-Definitionen für parser + serializer (gegen Duplikation
// und LOC). Subset des Obsidian-Tasks-Plugins, siehe On-Disk-Format in der Spec.

// Datums-Felder: Emoji -> Feldname. Reihenfolge bestimmt zugleich die
// Render-Reihenfolge NEUER Felder im serializer (siehe DATE_ORDER unten).
export const DATE_TOKENS = {
  "➕": "created",
  "🛫": "start",
  "⏳": "scheduled",
  "📅": "due",
  "✅": "doneDate",
} as const;

export type DateField = (typeof DATE_TOKENS)[keyof typeof DATE_TOKENS];

// Prioritäts-Emoji -> TodoPriority. "normal" hat bewusst KEIN Emoji.
export const PRIORITY_TOKENS: Record<string, TodoPriority> = {
  "🔺": "highest",
  "⏫": "high",
  "🔼": "medium",
  "🔽": "low",
  "⏬": "lowest",
};

export const PRIORITY_EMOJI: Record<TodoPriority, string> = {
  highest: "🔺",
  high: "⏫",
  medium: "🔼",
  normal: "",
  low: "🔽",
  lowest: "⏬",
};

export const RECURRENCE_TOKEN = "🔁";

// Render-Reihenfolge NEUER Felder (Tasks-Plugin-Konvention): Priorität, dann
// Recurrence, dann Datumsfelder in created/start/scheduled/due/doneDate-Folge.
// Bestehende Felder werden surgical an Ort und Stelle ersetzt (nicht umsortiert),
// damit der Round-Trip byte-genau bleibt.
export const DATE_ORDER: DateField[] = ["created", "start", "scheduled", "due", "doneDate"];

// YYYY-MM-DD nach einem Token, mit umgebendem Whitespace.
export const DATE_RE = /(\d{4}-\d{2}-\d{2})/;

// Hashtag-Labels: #word (inkl. /-Pfade und Bindestriche). Bewusst simpel —
// Phase 1 braucht keine vollständige Obsidian-Tag-Grammatik.
export const TAG_RE = /#[\w/-]+/g;
