// Reine Berlin-Zeit-Helfer (Europe/Berlin), ausgelagert aus todos.ts, damit
// todos.ts unter dem LOC-Limit bleibt. Keine Abhängigkeiten, keine Mutation.

export function todayBerlinYmd(): string {
  // Recurrence "when done" verankert am heutigen Datum. Europe/Berlin, da der
  // Nutzer in dieser Zone arbeitet (Spec: TZ nur außerhalb von SQLite).
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function nowBerlinHHmm(): string {
  // Aktuelle Berlin-Uhrzeit als nullgepaddetes "HH:mm" für den Reminder-Zeit-Gate
  // (chronologischer String-Vergleich). hour12:false, NICHT hourCycle:"h24" —
  // h24 rendert Mitternacht als 24:00 und bricht den String-Vergleich.
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}
