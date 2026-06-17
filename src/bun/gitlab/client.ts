import type { Settings } from "../../shared/types";
import type { GitLabClient } from "./types";
import { AppErrorError } from "../lib/app-error";
import { fetchIssues, fetchIssue } from "./fetch";
import { bookTime } from "./push";

/** Schmale Sicht auf den HTTP-Client, die fetch.ts / push.ts brauchen. */
export interface ApiClient {
  apiRequest(path: string, options?: RequestInit): Promise<Response>;
}

function createRateLimiter(reqPerSec: number) {
  let tokens = reqPerSec;
  let lastRefill = Date.now();
  return {
    async throttle(): Promise<void> {
      const now = Date.now();
      const elapsed = (now - lastRefill) / 1000;
      tokens = Math.min(reqPerSec, tokens + elapsed * reqPerSec);
      lastRefill = now;
      if (tokens < 1) {
        await Bun.sleep(Math.ceil(1000 / reqPerSec));
        tokens = 0;
      } else {
        tokens--;
      }
    },
  };
}

function toApiError(status: number, body: string): AppErrorError {
  const codes: Record<number, string> = {
    401: "AUTH_FAILED",
    403: "AUTH_FAILED",
    404: "NOT_FOUND",
    429: "RATE_LIMITED",
  };
  return new AppErrorError({
    code: codes[status] ?? "GITLAB_ERROR",
    message: body || `GitLab request failed (${status})`,
    retry: status === 429 || status >= 500,
  });
}

export function createGitLabClient(token: string, settings: Settings): GitLabClient {
  const limiter = createRateLimiter(5); // 5 req/s

  async function apiRequest(path: string, options?: RequestInit): Promise<Response> {
    await limiter.throttle();
    const res = await fetch(`${settings.gitlabUrl}/api/v4${path}`, {
      ...options,
      headers: {
        "PRIVATE-TOKEN": token,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    if (!res.ok) throw toApiError(res.status, await res.text());
    return res;
  }

  const client: ApiClient = { apiRequest };

  return {
    fetchIssues: (projectId, since) => fetchIssues(client, projectId, since),
    fetchIssue: (projectId, issueIid) => fetchIssue(client, projectId, issueIid),
    bookTime: (projectId, issueIid, durationMinutes, spentAt, note) =>
      bookTime(client, projectId, issueIid, durationMinutes, spentAt, note),
  };
}
