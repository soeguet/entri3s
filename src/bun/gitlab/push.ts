import type { ApiClient } from "./client";
import { formatDuration } from "./format";

/**
 * Bucht Zeit auf ein Issue via `add_spent_time`. duration im GitLab-Format,
 * note wird als zusätzlicher Kommentar gesetzt.
 */
export async function bookTime(
  client: ApiClient,
  projectId: number,
  issueIid: number,
  durationMinutes: number,
  note: string,
): Promise<void> {
  const duration = formatDuration(durationMinutes);
  const params = new URLSearchParams({ duration, summary: note });
  await client.apiRequest(`/projects/${projectId}/issues/${issueIid}/add_spent_time?${params}`, {
    method: "POST",
  });
}
