import type { TodoTask } from "../../shared/types";

// Reine, datumsbasierte Reminder-Logik (keine I/O, keine Uhrzeit). Baut aus den
// offenen Tasks eine Tages-Zusammenfassung "heute fällig / überfällig" und
// entscheidet via lastReminderDate, ob heute schon benachrichtigt wurde.
//
// Bewusst datumsbasiert (nicht uhrzeitgenau): Es gibt höchstens eine
// Benachrichtigung pro Kalendertag (Europe/Berlin), kein Termin-Wecker.

export interface ReminderResult {
  title: string;
  body: string;
  lastDate: string;
}

export function buildReminder(
  tasks: TodoTask[],
  today: string,
  lastReminderDate: string,
): ReminderResult | null {
  // Heute schon benachrichtigt -> nichts tun.
  if (lastReminderDate === today) return null;

  const dueToday = tasks.filter((t) => !t.done && t.due === today);
  const overdue = tasks.filter((t) => !t.done && t.due !== null && t.due < today);

  // Nichts fällig: lastReminderDate NICHT vorrücken, damit später am selben Tag
  // hinzugefügte fällige Tasks heute noch eine Benachrichtigung auslösen können.
  if (dueToday.length + overdue.length === 0) return null;

  const parts: string[] = [];
  if (dueToday.length > 0) parts.push(`${dueToday.length} heute fällig`);
  if (overdue.length > 0) parts.push(`${overdue.length} überfällig`);

  return { title: "Fällige Aufgaben", body: parts.join(" · "), lastDate: today };
}
