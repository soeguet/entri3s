import type { GqlClient } from "./client";
import type { GitLabIssue } from "./types";
import { createLogger } from "../lib/logger";

const log = createLogger("gitlab");

/** GraphQL-Form eines Issue-Knotens (Teilmenge des GitLab-Schemas). */
interface GqlIssueNode {
  id: string; // GID des Issues selbst, z.B. "gid://gitlab/Issue/456"
  iid: string; // GraphQL liefert iid als String
  title: string;
  state: string; // IssueState-Enum, bereits lowercase: opened/closed/locked
  webUrl: string;
  updatedAt: string;
  timeEstimate: number | null;
  totalTimeSpent: number | null;
  // `Issue.project { id }` existiert auf dieser GitLab-Version NICHT — der
  // GraphQL-Typ Issue bietet stattdessen das flache Feld `projectId`. Je nach
  // Version ist das ein Int (123) oder eine GID-String ("gid://gitlab/Project/123").
  projectId: number | string;
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
    nodes { id iid title state webUrl updatedAt timeEstimate totalTimeSpent projectId }
    pageInfo { hasNextPage endCursor }
  }
}`;

/**
 * Parst eine GitLab-Projekt-/Issue-ID auf eine reine Zahl. Akzeptiert sowohl die
 * GID-Form ("gid://gitlab/Project/123" → 123) als auch einen bereits numerischen
 * Wert (123) — `Issue.projectId` liefert je nach GitLab-Version das eine oder das
 * andere.
 */
function parseGid(gid: number | string): number {
  if (typeof gid === "number") return gid;
  const last = gid.split("/").pop() ?? "";
  return Number(last);
}

/** Mappt einen GraphQL-Knoten auf die interne GitLabIssue-Form. */
function mapNode(node: GqlIssueNode): GitLabIssue {
  return {
    iid: Number(node.iid),
    globalId: parseGid(node.id),
    project_id: parseGid(node.projectId),
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
  let page = 0;

  while (true) {
    const data = (await client.gqlRequest(ISSUES_QUERY, {
      after,
      since: since ? since.toISOString() : null,
    })) as IssuesResponse;

    page++;
    for (const node of data.issues.nodes) all.push(mapNode(node));
    log.info(`fetchIssues Seite ${page}`, { nodes: data.issues.nodes.length, total: all.length });

    const pageInfo = data.issues.pageInfo;
    if (!pageInfo.hasNextPage) break;
    after = pageInfo.endCursor;
  }

  return all;
}
