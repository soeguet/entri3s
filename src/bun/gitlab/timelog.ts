import type { GqlClient } from "./client";
import type { TimelogTarget } from "./types";
import { formatDuration } from "./format";

/** Timelog-Summaries werden bei 255 Zeichen gekappt (GitLab-Limit / Produktentscheidung). */
export const MAX_SUMMARY_LENGTH = 255;

/**
 * Bucht Zeit als GitLab-Timelog über die GraphQL-Mutation `timelogCreate`.
 *
 * Anders als die frühere `/spend`-Quick-Action (die einen sichtbaren Kommentar
 * am Issue erzeugt hat) landet der Buchungstext hier in der `summary` des
 * Timelogs — also genau im Feld "Add time entry → Summary" der GitLab-Zeiterfassung.
 * Es entsteht KEIN Kommentar und keine Notification an Watcher.
 *
 * `spentAt` ist ein ISO-Date (YYYY-MM-DD) und erlaubt ein frei wählbares
 * Buchungsdatum. Rückgabe ist die numerische Timelog-ID (für die bookings-Tabelle
 * und spätere Korrektur-Löschung via `deleteTimelog`).
 */
const CREATE_MUTATION = `mutation($issuableId: IssuableID!, $timeSpent: String!, $spentAt: Time, $summary: String!) {
  timelogCreate(input: { issuableId: $issuableId, timeSpent: $timeSpent, spentAt: $spentAt, summary: $summary }) {
    timelog { id }
    errors
  }
}`;

interface TimelogCreateResponse {
  timelogCreate: { timelog: { id: string } | null; errors: string[] };
}

/** Parst die trailing Integer-ID aus einer GitLab-GID ("gid://gitlab/Timelog/42" → 42). */
function parseGid(gid: string): number {
  return Number(gid.split("/").pop() ?? "");
}

function truncate(summary: string): string {
  return summary.trim().slice(0, MAX_SUMMARY_LENGTH);
}

/**
 * Bucht auf 12:00 UTC des gewählten Kalendertags statt auf den nackten
 * Datums-String. GitLab interpretiert ein reines Datum als Mitternacht und
 * verschob die Buchung über die Zeitzonen-Umrechnung sonst auf den Vortag
 * (z.B. 2026-06-15 → 2026-06-14 22:00 UTC). Mittags-UTC liegt in jeder
 * relevanten Zeitzone sicher auf demselben Tag — entscheidend ist der Tag.
 */
function toNoonUtc(spentAt: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(spentAt) ? `${spentAt}T12:00:00Z` : spentAt;
}

export async function createTimelog(
  client: GqlClient,
  target: TimelogTarget,
  durationMinutes: number,
  spentAt: string,
  summary: string,
): Promise<number> {
  const data = (await client.gqlRequest(CREATE_MUTATION, {
    issuableId: `gid://gitlab/Issue/${target.issueGlobalId}`,
    timeSpent: formatDuration(durationMinutes),
    spentAt: toNoonUtc(spentAt),
    summary: truncate(summary),
  })) as TimelogCreateResponse;

  const result = data.timelogCreate;
  if (result.errors.length > 0 || !result.timelog) {
    throw new Error(`timelogCreate fehlgeschlagen: ${result.errors.join("; ") || "kein Timelog"}`);
  }
  return parseGid(result.timelog.id);
}

const TIMELOGS_QUERY = `query($projectId: ProjectID!, $startTime: Time, $endTime: Time) {
  timelogs(projectId: $projectId, startTime: $startTime, endTime: $endTime, first: 100) {
    nodes { id timeSpent spentAt summary issue { iid } }
  }
}`;

interface TimelogNode {
  id: string;
  timeSpent: number; // Sekunden
  spentAt: string;
  summary: string | null;
  issue: { iid: string } | null;
}

interface TimelogsResponse {
  timelogs: { nodes: TimelogNode[] };
}

/**
 * Doppelbuchungs-Schutz: sucht einen bereits existierenden, inhaltlich identischen
 * Timelog auf dem Issue (gleiche Dauer, gleiches Datum, gleiche Summary). Wird vor
 * jedem `createTimelog` aufgerufen — brach ein vorheriger Versuch nach dem API-Call
 * ab (DB-Fehler, verlorene Response, Crash), liegt der Timelog bereits in GitLab und
 * darf NICHT erneut gebucht werden. Best-effort: scheitert die Query, soll der Aufrufer
 * trotzdem buchen können (siehe Worker).
 */
export async function findTimelog(
  client: GqlClient,
  target: TimelogTarget,
  durationMinutes: number,
  spentAt: string,
  summary: string,
): Promise<number | null> {
  const data = (await client.gqlRequest(TIMELOGS_QUERY, {
    projectId: `gid://gitlab/Project/${target.projectId}`,
    startTime: `${spentAt}T00:00:00Z`,
    endTime: `${spentAt}T23:59:59Z`,
  })) as TimelogsResponse;

  const wantedSeconds = durationMinutes * 60;
  const wantedSummary = truncate(summary);
  const hit = data.timelogs.nodes.find(
    (n) =>
      n.issue?.iid === String(target.issueIid) &&
      n.timeSpent === wantedSeconds &&
      (n.summary ?? "") === wantedSummary,
  );
  return hit ? parseGid(hit.id) : null;
}

const DELETE_MUTATION = `mutation($id: TimelogID!) {
  timelogDelete(input: { id: $id }) {
    timelog { id }
    errors
  }
}`;

interface TimelogDeleteResponse {
  timelogDelete: { timelog: { id: string } | null; errors: string[] };
}

/**
 * Erkennt GitLab-Fehlermeldungen, die "Timelog existiert nicht (mehr)" bedeuten.
 * Schließt GitLabs Standard-Autorisierungsmeldung ein ("The resource that you are
 * attempting to access does not exist or you don't have permission..."), die beim
 * Löschen eines extern bereits entfernten Timelogs erscheint. Das maskiert bewusst
 * auch echte Permission-Fehler dieses einen Calls — ein Timelog, den der Worker
 * nicht löschen darf, lässt sich ohnehin nicht stornieren, also wird der lokale
 * Record entfernt statt für immer hängen zu bleiben.
 */
function isAlreadyGone(errors: string[]): boolean {
  return errors.some((e) =>
    /not found|does not exist|resource not available|don't have permission/i.test(e),
  );
}

/**
 * Löscht einen Timelog wieder (für Korrektur-Buchungen). Ist der Timelog bereits
 * weg (z.B. ein Retry nach erfolgreichem Löschen ODER direkt in GitLab gelöscht),
 * wird das als Erfolg gewertet — sonst bliebe der lokale Booking-Record für immer
 * hängen und das booking_delete-Event liefe ins Dead-Letter.
 *
 * Wichtig: einen extern gelöschten Timelog meldet GitLab nicht im feldspezifischen
 * `timelogDelete.errors`, sondern als Top-Level-GraphQL-Error — der wird von
 * `gqlRequest` als Exception geworfen, bevor wir `result` sehen. Daher BEIDE Pfade
 * über `isAlreadyGone` tolerieren.
 */
export async function deleteTimelog(client: GqlClient, timelogId: number): Promise<void> {
  let data: TimelogDeleteResponse;
  try {
    data = (await client.gqlRequest(DELETE_MUTATION, {
      id: `gid://gitlab/Timelog/${timelogId}`,
    })) as TimelogDeleteResponse;
  } catch (e) {
    if (isAlreadyGone([e instanceof Error ? e.message : String(e)])) return;
    throw e;
  }

  const result = data.timelogDelete;
  if (result.errors.length > 0 && !isAlreadyGone(result.errors)) {
    throw new Error(`timelogDelete fehlgeschlagen: ${result.errors.join("; ")}`);
  }
}
