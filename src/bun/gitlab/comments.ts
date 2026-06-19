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

interface NotesResponse {
  project: {
    issue: {
      notes: {
        nodes: GqlNoteNode[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } | null;
  } | null;
}

/**
 * Kommentare (Notes) eines Issues. Die notes-Connection kennt KEIN `updatedAfter`
 * (anders als die issues-Connection), daher holen wir immer alle Seiten.
 * `$iid` ist im GitLab-Schema ein String! — daher String(issueIid).
 */
const NOTES_QUERY = `query($fullPath: ID!, $iid: String!, $after: String) {
  project(fullPath: $fullPath) {
    issue(iid: $iid) {
      notes(first: 100, after: $after) {
        nodes { id body bodyHtml system author { id username name } createdAt updatedAt }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`;

/** Parst die trailing Integer-ID aus einer GitLab-GID ("gid://gitlab/Note/456" → 456). */
function parseGid(gid: string): number {
  return Number(gid.split("/").pop() ?? "");
}

function mapNode(node: GqlNoteNode): GitLabComment {
  return {
    noteId: parseGid(node.id),
    authorUsername: node.author?.username ?? "",
    authorName: node.author?.name ?? "",
    body: node.body,
    bodyHtml: node.bodyHtml,
    system: node.system,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  };
}

/** Alle Kommentare eines Issues (Cursor-Pagination über alle Note-Seiten). */
export async function fetchTicketComments(
  client: GqlClient,
  projectFullPath: string,
  issueIid: number,
): Promise<GitLabComment[]> {
  const comments: GitLabComment[] = [];
  let after: string | null = null;

  while (true) {
    const data = (await client.gqlRequest(NOTES_QUERY, {
      fullPath: projectFullPath,
      iid: String(issueIid),
      after,
    })) as NotesResponse;

    // Projekt nicht erreichbar oder Issue nicht (mehr) vorhanden → keine Kommentare.
    if (!data.project || !data.project.issue) return comments;

    const notes = data.project.issue.notes;
    for (const node of notes.nodes) comments.push(mapNode(node));

    if (!notes.pageInfo.hasNextPage) break;
    after = notes.pageInfo.endCursor;
  }

  return comments;
}
