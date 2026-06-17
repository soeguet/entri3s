import type { GqlClient } from "./client";
import type { GitLabIssue } from "./types";

/** GraphQL-Form eines Issue-Knotens (Teilmenge des GitLab-Schemas). */
interface GqlIssueNode {
  iid: string; // GraphQL liefert iid als String
  title: string;
  state: string; // IssueState-Enum, bereits lowercase: opened/closed/locked
  webUrl: string;
  updatedAt: string;
  timeEstimate: number | null;
  totalTimeSpent: number | null;
  project: { id: string }; // GID, z.B. "gid://gitlab/Project/123"
}

interface IssuesResponse {
  issues: {
    nodes: GqlIssueNode[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

/**
 * Root-level `issues`-Query: liefert projektübergreifend alle für den Token
 * sichtbaren Issues. KEIN `state`-Filter — der Sync braucht auch geschlossene
 * Issues für die Orphan-Erkennung. Cursor-Pagination über `after`/`endCursor`.
 */
const ISSUES_QUERY = `query($after: String, $since: Time) {
  issues(first: 100, after: $after, updatedAfter: $since) {
    nodes { iid title state webUrl updatedAt timeEstimate totalTimeSpent project { id } }
    pageInfo { hasNextPage endCursor }
  }
}`;

/**
 * Parst die trailing Integer-ID aus einer GitLab-GID
 * ("gid://gitlab/Project/123" → 123).
 */
function parseGid(gid: string): number {
  const last = gid.split("/").pop() ?? "";
  return Number(last);
}

/** Mappt einen GraphQL-Knoten auf die interne GitLabIssue-Form. */
function mapNode(node: GqlIssueNode): GitLabIssue {
  return {
    iid: Number(node.iid),
    project_id: parseGid(node.project.id),
    title: node.title,
    state: node.state,
    web_url: node.webUrl,
    updated_at: node.updatedAt,
    time_stats: {
      time_estimate: node.timeEstimate ?? 0,
      total_time_spent: node.totalTimeSpent ?? 0,
    },
  };
}

/**
 * Projektübergreifend alle erreichbaren Issues per GraphQL mit Cursor-Pagination
 * (nie ohne!). Ersetzt den REST-Lese-Pfad; Buchungen bleiben REST. Jedes Issue
 * trägt seine `project_id` (aus der Projekt-GID), sodass der Sync weiterhin pro
 * Projekt zuordnen kann.
 */
export async function fetchIssues(client: GqlClient, since?: Date): Promise<GitLabIssue[]> {
  const all: GitLabIssue[] = [];
  let after: string | null = null;

  while (true) {
    const data = (await client.gqlRequest(ISSUES_QUERY, {
      after,
      since: since ? since.toISOString() : null,
    })) as IssuesResponse;

    for (const node of data.issues.nodes) all.push(mapNode(node));

    const pageInfo = data.issues.pageInfo;
    if (!pageInfo.hasNextPage) break;
    after = pageInfo.endCursor;
  }

  return all;
}
