import type { ApiClient } from "./client";
import type { GitLabIssue } from "./types";

/**
 * Einzelnes Issue per REST (noch REST, vom GitLabClient-Interface genutzt).
 * Der projektübergreifende Sync-Lesepfad (`fetchIssues`) läuft inzwischen über
 * GraphQL — siehe graphql.ts.
 */
interface RestIssue extends Omit<GitLabIssue, "globalId" | "assignees" | "userNotesCount"> {
  id: number; // REST liefert die globale Issue-ID als `id`
  user_notes_count?: number;
}

export async function fetchIssue(
  client: ApiClient,
  projectId: number,
  issueIid: number,
): Promise<GitLabIssue | null> {
  const res = await client.apiRequest(`/projects/${projectId}/issues/${issueIid}`);
  const raw = (await res.json()) as RestIssue;
  // Einzel-Issue-REST-Pfad synct keine Assignees (nur Sync-/Buchungslookup) → leer.
  return { ...raw, globalId: raw.id, assignees: [], userNotesCount: raw.user_notes_count ?? 0 };
}
