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

function page(nodes: unknown[], hasNextPage = false, endCursor: string | null = null) {
  return { nodes, pageInfo: { hasNextPage, endCursor } };
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

test("aggregates notes across two pages and maps the GID", async () => {
  const captured: Captured[] = [];
  const client = fakeClient(captured, {
    start: { project: { issue: { notes: page([noteNode(1)], true, "CURSOR_A") } } },
    CURSOR_A: { project: { issue: { notes: page([noteNode(456)]) } } },
  });

  const comments = await fetchTicketComments(client, "grp/a", 5);

  expect(comments).toHaveLength(2);
  expect(comments.map((c) => c.noteId)).toEqual([1, 456]);
  // $iid wird als String übergeben.
  expect(captured[0].variables.iid).toBe("5");
  expect(captured[0].variables.after).toBeNull();
  expect(captured[1].variables.after).toBe("CURSOR_A");
});

test("falls back to empty author fields when author is null", async () => {
  const client = fakeClient([], {
    start: {
      project: { issue: { notes: page([noteNode(1, { author: null, system: true })]) } },
    },
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
