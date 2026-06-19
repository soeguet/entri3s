import type { GqlClient } from "./client";
import type { GitLabComment } from "./types";

/** GraphQL-Form eines Note-Knotens (Teilmenge des GitLab-Schemas). */
interface GqlNoteNode {
  id: string; // GID der Note, z.B. "gid://gitlab/Note/456"
  body: string;
  bodyHtml: string;
  system: boolean;
  author: { id: string; username: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

/** GraphQL-Form eines Discussion-Knotens: bündelt zusammengehörige Notes. */
interface GqlDiscussionNode {
  id: string; // GID der Discussion, z.B. "gid://gitlab/Discussion/<hash>"
  notes: { nodes: GqlNoteNode[] };
}

interface DiscussionsResponse {
  project: {
    issue: {
      discussions: {
        nodes: GqlDiscussionNode[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } | null;
  } | null;
}

/**
 * Kommentare (Notes) eines Issues über die discussions-Connection. Eine Discussion
 * mit MEHREREN Notes ist ein Reply-Thread (erste Note = Ursprung, weitere = Antworten);
 * Top-Level-Kommentare und System-Notes sind je eine eigene Discussion mit einer Note.
 * Anders als die issues-Connection kennt diese Connection KEIN `updatedAfter`,
 * daher holen wir immer alle Seiten. `$iid` ist im GitLab-Schema ein String!
 *
 * Limitation v1: innere notes(first: 100) — Discussions mit >100 Antworten werden
 * abgeschnitten (extrem selten). Akzeptiert.
 */
const DISCUSSIONS_QUERY = `query($fullPath: ID!, $iid: String!, $after: String) {
  project(fullPath: $fullPath) {
    issue(iid: $iid) {
      discussions(first: 100, after: $after) {
        nodes {
          id
          notes(first: 100) {
            nodes { id body bodyHtml system author { id username name } createdAt updatedAt }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`;

/** Parst die trailing Integer-ID aus einer GitLab-GID ("gid://gitlab/Note/456" → 456). */
function parseGid(gid: string): number {
  return Number(gid.split("/").pop() ?? "");
}

function mapNode(node: GqlNoteNode, discussionId: string): GitLabComment {
  return {
    noteId: parseGid(node.id),
    discussionId,
    authorUsername: node.author?.username ?? "",
    authorName: node.author?.name ?? "",
    body: node.body,
    bodyHtml: node.bodyHtml,
    system: node.system,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  };
}

/** Alle Kommentare eines Issues (Cursor-Pagination über alle Discussion-Seiten). */
export async function fetchTicketComments(
  client: GqlClient,
  projectFullPath: string,
  issueIid: number,
): Promise<GitLabComment[]> {
  const comments: GitLabComment[] = [];
  let after: string | null = null;

  while (true) {
    const data = (await client.gqlRequest(DISCUSSIONS_QUERY, {
      fullPath: projectFullPath,
      iid: String(issueIid),
      after,
    })) as DiscussionsResponse;

    // Projekt nicht erreichbar oder Issue nicht (mehr) vorhanden → keine Kommentare.
    if (!data.project || !data.project.issue) return comments;

    const discussions = data.project.issue.discussions;
    for (const discussion of discussions.nodes) {
      // discussion.id ist eine GID mit HASH-String als trailing-Teil (KEINE Zahl)
      // — daher NICHT parseGid, sondern den trailing-Teil als String übernehmen.
      const discussionId = discussion.id.split("/").pop() ?? "";
      for (const node of discussion.notes.nodes) comments.push(mapNode(node, discussionId));
    }

    if (!discussions.pageInfo.hasNextPage) break;
    after = discussions.pageInfo.endCursor;
  }

  return comments;
}
