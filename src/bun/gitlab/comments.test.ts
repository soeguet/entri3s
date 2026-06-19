import { test, expect } from "bun:test";
import type { GqlClient } from "./client";
import { fetchTicketComments } from "./comments";

interface Captured {
  query: string;
  variables: Record<string, unknown>;
}

function noteNode(noteId: number, extra: Record<string, unknown> = {}) {
  return {
    id: `gid://gitlab/Note/${noteId}`,
    body: `body ${noteId}`,
    bodyHtml: `<p>body ${noteId}</p>`,
    system: false,
    author: { id: "gid://gitlab/User/7", username: "alice", name: "Alice" },
    createdAt: "2024-06-17T10:00:00.000Z",
    updatedAt: "2024-06-17T10:00:00.000Z",
    ...extra,
  };
}

/** Eine Discussion mit ihren Notes; die ID ist ein Hash-String (KEINE Zahl). */
function discussionNode(hash: string, notes: unknown[]) {
  return { id: `gid://gitlab/Discussion/${hash}`, notes: { nodes: notes } };
}

function page(nodes: unknown[], hasNextPage = false, endCursor: string | null = null) {
  return { nodes, pageInfo: { hasNextPage, endCursor } };
}

function issue(discussions: ReturnType<typeof page>) {
  return { project: { issue: { discussions } } };
}

/** Fake-GqlClient: liefert je nach `after`-Variable kanned Seiten. */
function fakeClient(captured: Captured[], pages: Record<string, unknown>): GqlClient {
  return {
    async gqlRequest(query, variables) {
      captured.push({ query, variables });
      const key = (variables.after as string | null) ?? "start";
      return pages[key];
    },
  };
}

test("aggregates discussions across two pages and maps the note GID", async () => {
  const captured: Captured[] = [];
  const client = fakeClient(captured, {
    start: issue(page([discussionNode("aaa", [noteNode(1)])], true, "CURSOR_A")),
    CURSOR_A: issue(page([discussionNode("bbb", [noteNode(456)])])),
  });

  const comments = await fetchTicketComments(client, "grp/a", 5);

  expect(comments).toHaveLength(2);
  expect(comments.map((c) => c.noteId)).toEqual([1, 456]);
  // $iid wird als String übergeben.
  expect(captured[0].variables.iid).toBe("5");
  expect(captured[0].variables.after).toBeNull();
  expect(captured[1].variables.after).toBe("CURSOR_A");
});

test("notes of one discussion share its discussionId; distinct discussions differ", async () => {
  const client = fakeClient([], {
    start: issue(
      page([
        discussionNode("thread1", [noteNode(1), noteNode(2), noteNode(3)]),
        discussionNode("thread2", [noteNode(4)]),
      ]),
    ),
  });

  const comments = await fetchTicketComments(client, "grp/a", 5);

  expect(comments).toHaveLength(4);
  // Hash-String wird übernommen (kein numerisches Parsing).
  expect(comments[0].discussionId).toBe("thread1");
  expect(comments[1].discussionId).toBe("thread1");
  expect(comments[2].discussionId).toBe("thread1");
  expect(comments[3].discussionId).toBe("thread2");
});

test("falls back to empty author fields when author is null", async () => {
  const client = fakeClient([], {
    start: issue(page([discussionNode("aaa", [noteNode(1, { author: null, system: true })])])),
  });
  const comments = await fetchTicketComments(client, "grp/a", 1);
  expect(comments[0].authorUsername).toBe("");
  expect(comments[0].authorName).toBe("");
  expect(comments[0].system).toBe(true);
});

test("returns [] when the project is null", async () => {
  const client = fakeClient([], { start: { project: null } });
  expect(await fetchTicketComments(client, "grp/gone", 1)).toEqual([]);
});

test("returns [] when the issue is null", async () => {
  const client = fakeClient([], { start: { project: { issue: null } } });
  expect(await fetchTicketComments(client, "grp/a", 99)).toEqual([]);
});
