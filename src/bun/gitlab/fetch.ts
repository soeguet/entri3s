import type { ApiClient } from "./client";
import type { GitLabIssue } from "./types";

/**
 * Projektübergreifend alle für den Token erreichbaren Issues mit vollständiger
 * Pagination (nie ohne!). Nutzt den globalen `/issues`-Endpoint mit `scope=all`
 * — nicht mehr `/projects/:id/issues`. Jedes Issue trägt seine `project_id`,
 * sodass der Sync weiterhin pro Projekt zuordnen kann.
 */
export async function fetchIssues(client: ApiClient, since?: Date): Promise<GitLabIssue[]> {
  const all: GitLabIssue[] = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      scope: "all",
      per_page: "100",
      page: String(page),
      ...(since ? { updated_after: since.toISOString() } : {}),
    });
    const res = await client.apiRequest(`/issues?${params}`);
    const issues = (await res.json()) as GitLabIssue[];
    all.push(...issues);

    const totalPages = Number(res.headers.get("x-total-pages") ?? 1);
    if (page >= totalPages) break;
    page++;
  }

  return all;
}

export async function fetchIssue(
  client: ApiClient,
  projectId: number,
  issueIid: number,
): Promise<GitLabIssue | null> {
  const res = await client.apiRequest(`/projects/${projectId}/issues/${issueIid}`);
  return (await res.json()) as GitLabIssue;
}
