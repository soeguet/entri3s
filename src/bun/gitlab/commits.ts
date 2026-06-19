import type { ApiClient } from "./client";
import type { GitLabCommit } from "./types";

export async function fetchCommits(
  client: ApiClient,
  projectId: number,
  since: string,
  until: string,
): Promise<GitLabCommit[]> {
  const params = new URLSearchParams({
    since,
    until,
    per_page: "20",
    order: "default",
  });
  const res = await client.apiRequest(`/projects/${projectId}/repository/commits?${params}`);
  return (await res.json()) as GitLabCommit[];
}
