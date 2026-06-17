import { test, expect } from "bun:test";
import type { GqlClient } from "./client";
import { fetchIssues } from "./graphql";

interface Captured {
  query: string;
  variables: Record<string, unknown>;
}

function node(iid: string, projectId: number, extra: Record<string, unknown> = {}) {
  return {
    id: `gid://gitlab/Issue/${1000 + Number(iid)}`,
    iid,
    title: `Issue ${iid}`,
    state: "opened",
    webUrl: `https://gl.example.com/-/issues/${iid}`,
    updatedAt: "2024-06-17T10:00:00.000Z",
    timeEstimate: 3600,
    totalTimeSpent: 1800,
    project: { id: `gid://gitlab/Project/${projectId}` },
    ...extra,
  };
}

/** Fake-GqlClient, der zwei kanned Seiten per Cursor zurückgibt. */
function pagingClient(captured: Captured[]): GqlClient {
  const pages: Record<string, unknown> = {
    start: {
      issues: {
        nodes: [node("1", 123), node("2", 123)],
        pageInfo: { hasNextPage: true, endCursor: "CURSOR_A" },
      },
    },
    CURSOR_A: {
      issues: {
        nodes: [node("3", 456)],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    },
  };
  return {
    async gqlRequest(query, variables) {
      captured.push({ query, variables });
      const key = (variables.after as string | null) ?? "start";
      return pages[key];
    },
  };
}

test("maps GraphQL nodes to GitLabIssue and follows cursor pagination", async () => {
  const captured: Captured[] = [];
  const issues = await fetchIssues(pagingClient(captured), new Date("2024-06-01T00:00:00.000Z"));

  // Zwei Seiten → drei Issues insgesamt.
  expect(captured).toHaveLength(2);
  expect(issues).toHaveLength(3);

  // iid als Number, project_id aus der GID geparst, time_stats gemappt.
  expect(issues[0]).toEqual({
    iid: 1,
    globalId: 1001,
    project_id: 123,
    title: "Issue 1",
    state: "opened",
    web_url: "https://gl.example.com/-/issues/1",
    updated_at: "2024-06-17T10:00:00.000Z",
    time_stats: { time_estimate: 3600, total_time_spent: 1800 },
  });
  expect(issues[2].iid).toBe(3);
  expect(issues[2].project_id).toBe(456);
});

test("passes the cursor (endCursor) as `after` on the second page", async () => {
  const captured: Captured[] = [];
  await fetchIssues(pagingClient(captured));

  expect(captured[0].variables.after).toBeNull();
  expect(captured[1].variables.after).toBe("CURSOR_A");
});

test("forwards `since` as ISO string and null when omitted", async () => {
  const captured: Captured[] = [];
  await fetchIssues(pagingClient(captured), new Date("2024-06-01T00:00:00.000Z"));
  expect(captured[0].variables.since).toBe("2024-06-01T00:00:00.000Z");

  const captured2: Captured[] = [];
  await fetchIssues(pagingClient(captured2));
  expect(captured2[0].variables.since).toBeNull();
});

test("defaults null time fields to 0 in time_stats", async () => {
  const captured: Captured[] = [];
  const client: GqlClient = {
    async gqlRequest(query, variables) {
      captured.push({ query, variables });
      return {
        issues: {
          nodes: [node("9", 7, { timeEstimate: null, totalTimeSpent: null })],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    },
  };
  const issues = await fetchIssues(client);
  expect(issues[0].time_stats).toEqual({ time_estimate: 0, total_time_spent: 0 });
});

// Hinweis: Die Behandlung von GraphQL-`errors[]` (HTTP 200 mit errors-Array)
// liegt in client.ts `gqlRequest` (mappt auf AppError GITLAB_ERROR). Da sie an
// fetch() gebunden ist, wird sie hier nicht direkt getestet.
