// Reine Recurrence-Funktionen für ein Subset der Obsidian-Tasks-Plugin-Regeln.
// Unterstützt: "every day/week/month/year", "every N <unit>", optional Suffix
// "when done". Alles andere -> parseRule gibt null zurück -> READ-ONLY-Fallback
// (Task in entries nicht abhakbar). Niemals raten.

type Unit = "day" | "week" | "month" | "year";

export interface Rule {
  interval: number;
  unit: Unit;
  whenDone: boolean;
}

const UNIT_MAP: Record<string, Unit> = {
  day: "day",
  days: "day",
  daily: "day",
  week: "week",
  weeks: "week",
  weekly: "week",
  month: "month",
  months: "month",
  monthly: "month",
  year: "year",
  years: "year",
  yearly: "year",
};

export function parseRule(text: string | null): Rule | null {
  if (!text) return null;
  let s = text.trim().toLowerCase();
  let whenDone = false;
  if (s.endsWith("when done")) {
    whenDone = true;
    s = s.slice(0, -"when done".length).trim();
  }

  // "every day" / "every week" / ... oder reines "daily"/"weekly"/...
  if (UNIT_MAP[s]) return { interval: 1, unit: UNIT_MAP[s], whenDone };

  const m = s.match(/^every\s+(?:(\d+)\s+)?([a-z]+)$/);
  if (!m) return null;
  const interval = m[1] ? Number(m[1]) : 1;
  const unit = UNIT_MAP[m[2]];
  if (!unit || interval < 1) return null;
  return { interval, unit, whenDone };
}

// Addiert die Regel auf ein YYYY-MM-DD-Datum (UTC-stabil über Date.UTC).
function addRule(ymd: string, rule: Rule): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (rule.unit === "day") dt.setUTCDate(dt.getUTCDate() + rule.interval);
  else if (rule.unit === "week") dt.setUTCDate(dt.getUTCDate() + rule.interval * 7);
  else if (rule.unit === "month") dt.setUTCMonth(dt.getUTCMonth() + rule.interval);
  else dt.setUTCFullYear(dt.getUTCFullYear() + rule.interval);
  return dt.toISOString().slice(0, 10);
}

// Berechnet das nächste Fälligkeitsdatum. base = bestehendes Datum der Instanz
// (due bevorzugt); todayYmd = heutiges Datum für "when done"-Regeln. Gibt null
// zurück, wenn keine Basis vorhanden ist.
export function computeNext(rule: Rule, base: string | null, todayYmd: string): string | null {
  const anchor = rule.whenDone ? todayYmd : base;
  if (!anchor) return null;
  return addRule(anchor, rule);
}
