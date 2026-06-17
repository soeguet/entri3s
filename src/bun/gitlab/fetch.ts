import type { ApiClient } from "./client";
import type { GitLabIssue } from "./types";

/**
 * Einzelnes Issue per REST (noch REST, vom GitLabClient-Interface genutzt).
 * Der projektübergreifende Sync-Lesepfad (`fetchIssues`) läuft inzwischen über
 * GraphQL — siehe graphql.ts.
 */
interface RestIssue extends Omit<GitLabIssue, "globalId"> {
  id: number; // REST liefert die globale Issue-ID als `id`
}

export async function fetchIssue(
  client: ApiClient,
  projectId: number,
  issueIid: number,
): Promise<GitLabIssue | null> {
  const res = await client.apiRequest(`/projects/${projectId}/issues/${issueIid}`);
  const raw = (await res.json()) as RestIssue;
  return { ...raw, globalId: raw.id };
}
