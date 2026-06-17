import type { Settings } from "../../shared/types";
import type { GitLabClient } from "./types";
import { AppErrorError } from "../lib/app-error";
import { fetchIssue } from "./fetch";
import { fetchIssues as gqlFetchIssues } from "./graphql";
import { createTimelog, findTimelog, deleteTimelog } from "./timelog";

/** Schmale Sicht auf den HTTP-Client (REST), die fetch.ts / push.ts brauchen. */
export interface ApiClient {
  apiRequest(path: string, options?: RequestInit): Promise<Response>;
}

/** Schmale Sicht auf den GraphQL-Client, die graphql.ts braucht. */
export interface GqlClient {
  // `any` bewusst: GraphQL-Responses sind je Query verschieden geformt;
  // graphql.ts castet das Ergebnis auf die jeweilige Response-Form.
  gqlRequest(query: string, variables: Record<string, unknown>): Promise<any>;
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

/**
 * Validiert die konfigurierte gitlabUrl und liefert die normalisierte Basis-URL
 * (ohne trailing Slash). fetch() verlangt eine absolute URL — ist gitlabUrl leer
 * oder ohne http(s)-Schema, scheitert fetch() sonst mit "URL is invalid". Hier
 * stattdessen ein klarer AppError, der im UI verständlich angezeigt wird.
 * Geteilt von REST (`/api/v4`) und GraphQL (`/api/graphql`).
 */
function validatedBase(gitlabUrl: string): string {
  const base = gitlabUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) {
    throw new AppErrorError({
      code: "NO_GITLAB_URL",
      message: "Keine gültige GitLab-URL konfiguriert (z. B. https://gitlab.example.com)",
      retry: false,
    });
  }
  return base;
}

/** Baut die absolute REST-API-URL (`/api/v4`). */
function buildApiUrl(gitlabUrl: string, path: string): string {
  return `${validatedBase(gitlabUrl)}/api/v4${path}`;
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

/**
 * `getSettings` wird bei jedem Request frisch ausgewertet — so wirkt eine in den
 * Settings geänderte gitlabUrl sofort, ohne App-Neustart.
 */
export function createGitLabClient(token: string, getSettings: () => Settings): GitLabClient {
  const limiter = createRateLimiter(5); // 5 req/s

  async function apiRequest(path: string, options?: RequestInit): Promise<Response> {
    await limiter.throttle();
    const url = buildApiUrl(getSettings().gitlabUrl, path);
    const res = await fetch(url, {
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

  /**
   * GraphQL-Request gegen `/api/graphql`. Anders als REST:
   * - Auth über `Authorization: Bearer <token>` (nicht PRIVATE-TOKEN).
   * - GraphQL liefert HTTP 200 auch bei Fehlern → `errors[]` im Body prüfen.
   * Teilt den Rate-Limiter mit dem REST-Pfad (gleiche 5 req/s Instanz).
   */
  async function gqlRequest(query: string, variables: Record<string, unknown>): Promise<any> {
    await limiter.throttle();
    const url = `${validatedBase(getSettings().gitlabUrl)}/api/graphql`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw toApiError(res.status, await res.text());
    const json = (await res.json()) as { data?: unknown; errors?: Array<{ message: string }> };
    if (Array.isArray(json.errors) && json.errors.length > 0) {
      throw new AppErrorError({
        code: "GITLAB_ERROR",
        message: json.errors.map((e) => e.message).join("; "),
        retry: false,
      });
    }
    return json.data;
  }

  const client: ApiClient = { apiRequest };
  const gqlClient: GqlClient = { gqlRequest };

  return {
    fetchIssues: (since) => gqlFetchIssues(gqlClient, since),
    fetchIssue: (projectId, issueIid) => fetchIssue(client, projectId, issueIid),
    createTimelog: (target, durationMinutes, spentAt, summary) =>
      createTimelog(gqlClient, target, durationMinutes, spentAt, summary),
    findTimelog: (target, durationMinutes, spentAt, summary) =>
      findTimelog(gqlClient, target, durationMinutes, spentAt, summary),
    deleteTimelog: (timelogId) => deleteTimelog(gqlClient, timelogId),
  };
}
