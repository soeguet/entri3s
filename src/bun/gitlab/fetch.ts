import type { ApiClient } from "./client";
import type { GitLabIssue } from "./types";

/** Issues eines Projekts mit vollständiger Pagination (nie ohne!). */
export async function fetchIssues(
  client: ApiClient,
  projectId: number,
  since?: Date,
): Promise<GitLabIssue[]> {
  const all: GitLabIssue[] = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      per_page: "100",
      page: String(page),
      ...(since ? { updated_after: since.toISOString() } : {}),
    });
    const res = await client.apiRequest(`/projects/${projectId}/issues?${params}`);
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
