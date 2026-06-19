import type { GqlClient } from "./client";
import type { GitLabIssue, GitLabProject } from "./types";
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
  userNotesCount: number;
  assignees: { nodes: Array<{ id: string; username: string; name: string }> } | null;
  description: string | null;
  descriptionHtml: string | null;
  labels: { nodes: Array<{ title: string; color: string }> } | null;
  author: { username: string; name: string } | null;
  milestone: { title: string } | null;
  dueDate: string | null;
  createdAt: string | null;
}

/**
 * Referenz auf ein Projekt, in dem der User Mitglied ist. Deckungsgleich mit
 * GitLabProject (id, fullPath, name) — wird sowohl zum Iterieren der Issues als
 * auch zum Persistieren der Projekt-Metadaten genutzt.
 */
type ProjectRef = GitLabProject;

/**
 * Projekte, in denen der Token-User Mitglied ist (= "freigegeben"). Die
 * Root-`issues`-Query verlangt ein Pflicht-Filterargument ("You must provide at
 * least one filter argument") und taugt deshalb NICHT für einen unbegrenzten
 * Sync. Stattdessen iterieren wir die Mitglieds-Projekte und holen je Projekt die
 * Issues — die projektgebundene issues-Connection hat diese Einschränkung nicht.
 */
const PROJECTS_QUERY = `query($after: String) {
  projects(membership: true, first: 100, after: $after) {
    nodes { id fullPath name }
    pageInfo { hasNextPage endCursor }
  }
}`;

interface ProjectsResponse {
  projects: {
    nodes: Array<{ id: string; fullPath: string; name: string }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

/**
 * Issues eines einzelnen Projekts. KEIN `state`-Filter — der Sync braucht auch
 * geschlossene Issues für die Orphan-Erkennung. Cursor-Pagination, inkrementell
 * über `updatedAfter`.
 */
const PROJECT_ISSUES_QUERY = `query($fullPath: ID!, $after: String, $since: Time) {
  project(fullPath: $fullPath) {
    issues(first: 100, after: $after, updatedAfter: $since) {
      nodes { id iid title state webUrl updatedAt timeEstimate totalTimeSpent userNotesCount assignees { nodes { id username name } } description descriptionHtml labels { nodes { title color } } author { username name } milestone { title } dueDate createdAt }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

interface ProjectIssuesResponse {
  project: {
    issues: {
      nodes: GqlIssueNode[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  } | null;
}

/** Parst die trailing Integer-ID aus einer GitLab-GID ("gid://gitlab/Project/123" → 123). */
function parseGid(gid: string): number {
  const last = gid.split("/").pop() ?? "";
  return Number(last);
}

/** Mappt einen GraphQL-Knoten auf die interne GitLabIssue-Form. */
function mapNode(node: GqlIssueNode, projectId: number): GitLabIssue {
  return {
    iid: Number(node.iid),
    globalId: parseGid(node.id),
    project_id: projectId,
    title: node.title,
    state: node.state,
    web_url: node.webUrl,
    updated_at: node.updatedAt,
    userNotesCount: node.userNotesCount ?? 0,
    assignees: (node.assignees?.nodes ?? []).map((a) => ({
      id: parseGid(a.id), // User-GID "gid://gitlab/User/123" → 123
      username: a.username,
      name: a.name,
    })),
    time_stats: {
      time_estimate: node.timeEstimate ?? 0,
      total_time_spent: node.totalTimeSpent ?? 0,
    },
    description: node.description ?? null,
    descriptionHtml: node.descriptionHtml ?? null,
    labels: (node.labels?.nodes ?? []).map((l) => ({ title: l.title, color: l.color })),
    author: node.author ? { username: node.author.username, name: node.author.name } : null,
    milestoneTitle: node.milestone?.title ?? null,
    dueDate: node.dueDate ?? null,
    // createdAt ist im GitLab-Schema nicht-nullbar, wird hier aber defensiv
    // behandelt (Fallback auf updatedAt), damit ein unerwartetes null nicht crasht.
    issueCreatedAt: node.createdAt ?? node.updatedAt,
  };
}

/** Alle Projekte, in denen der User Mitglied ist (Cursor-Pagination, nie ohne!). */
export async function fetchProjects(client: GqlClient): Promise<GitLabProject[]> {
  const projects: ProjectRef[] = [];
  let after: string | null = null;

  while (true) {
    const data = (await client.gqlRequest(PROJECTS_QUERY, { after })) as ProjectsResponse;
    for (const node of data.projects.nodes) {
      projects.push({ id: parseGid(node.id), fullPath: node.fullPath, name: node.name });
    }
    const pageInfo = data.projects.pageInfo;
    if (!pageInfo.hasNextPage) break;
    after = pageInfo.endCursor;
  }

  return projects;
}

/** Alle Issues eines Projekts (Cursor-Pagination, inkrementell über `since`). */
async function fetchProjectIssues(
  client: GqlClient,
  project: ProjectRef,
  since?: Date,
): Promise<GitLabIssue[]> {
  const issues: GitLabIssue[] = [];
  let after: string | null = null;

  while (true) {
    const data = (await client.gqlRequest(PROJECT_ISSUES_QUERY, {
      fullPath: project.fullPath,
      after,
      since: since ? since.toISOString() : null,
    })) as ProjectIssuesResponse;

    if (!data.project) break; // Projekt nicht (mehr) erreichbar → überspringen
    for (const node of data.project.issues.nodes) issues.push(mapNode(node, project.id));

    const pageInfo = data.project.issues.pageInfo;
    if (!pageInfo.hasNextPage) break;
    after = pageInfo.endCursor;
  }

  return issues;
}

/**
 * Projektübergreifender Sync: ermittelt zuerst alle Mitglieds-Projekte und holt
 * dann projektweise (nach und nach, über den gemeinsamen Rate-Limiter gedrosselt)
 * alle Issues. Jedes Issue trägt die project_id seines Projekts.
 */
export async function fetchIssues(client: GqlClient, since?: Date): Promise<GitLabIssue[]> {
  const projects = await fetchProjects(client);
  log.info(`Sync über ${projects.length} Projekt(e)`, { since: since?.toISOString() ?? null });

  const all: GitLabIssue[] = [];
  for (const project of projects) {
    const issues = await fetchProjectIssues(client, project, since);
    if (issues.length > 0) {
      log.info(`Projekt ${project.fullPath}`, { projectId: project.id, issues: issues.length });
    }
    for (const issue of issues) all.push(issue);
  }

  log.info("fetchIssues fertig", { projects: projects.length, issues: all.length });
  return all;
}
