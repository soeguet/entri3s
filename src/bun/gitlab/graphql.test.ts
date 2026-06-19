import { test, expect } from "bun:test";
import type { GqlClient } from "./client";
import { fetchIssues, fetchProjects } from "./graphql";

interface Captured {
  query: string;
  variables: Record<string, unknown>;
}

function issueNode(iid: string, extra: Record<string, unknown> = {}) {
  return {
    id: `gid://gitlab/Issue/${1000 + Number(iid)}`,
    iid,
    title: `Issue ${iid}`,
    state: "opened",
    webUrl: `https://gl.example.com/-/issues/${iid}`,
    updatedAt: "2024-06-17T10:00:00.000Z",
    timeEstimate: 3600,
    totalTimeSpent: 1800,
    assignees: { nodes: [] },
    ...extra,
  };
}

function page(nodes: unknown[], hasNextPage = false, endCursor: string | null = null) {
  return { nodes, pageInfo: { hasNextPage, endCursor } };
}

function isProjectsQuery(query: string): boolean {
  return query.includes("projects(membership");
}

/**
 * Fake-GqlClient: beantwortet die Projekt-Liste und je nach `fullPath` die
 * projektgebundene issues-Query. `issuePages` bildet fullPath → kanned Seiten ab.
 */
function fakeClient(
  captured: Captured[],
  projects: Array<{ id: string; fullPath: string }>,
  issuePages: Record<string, Record<string, unknown>>,
): GqlClient {
  return {
    async gqlRequest(query, variables) {
      captured.push({ query, variables });
      if (isProjectsQuery(query)) {
        return { projects: page(projects) };
      }
      const fullPath = variables.fullPath as string;
      const key = (variables.after as string | null) ?? "start";
      return issuePages[`${fullPath}:${key}`];
    },
  };
}

test("iterates member projects and maps issues per project with injected project_id", async () => {
  const captured: Captured[] = [];
  const client = fakeClient(
    captured,
    [
      { id: "gid://gitlab/Project/123", fullPath: "grp/a" },
      { id: "gid://gitlab/Project/456", fullPath: "grp/b" },
    ],
    {
      "grp/a:start": { project: { issues: page([issueNode("1"), issueNode("2")]) } },
      "grp/b:start": { project: { issues: page([issueNode("3")]) } },
    },
  );

  const issues = await fetchIssues(client, new Date("2024-06-01T00:00:00.000Z"));

  // 1 projects-Query + 2 project-issues-Queries.
  expect(captured).toHaveLength(3);
  expect(issues).toHaveLength(3);

  expect(issues[0]).toEqual({
    iid: 1,
    globalId: 1001,
    project_id: 123,
    title: "Issue 1",
    state: "opened",
    web_url: "https://gl.example.com/-/issues/1",
    updated_at: "2024-06-17T10:00:00.000Z",
    assignees: [],
    time_stats: { time_estimate: 3600, total_time_spent: 1800 },
  });
  // Issue aus dem zweiten Projekt trägt dessen project_id.
  expect(issues[2].iid).toBe(3);
  expect(issues[2].project_id).toBe(456);
});

test("maps assignees, parsing their user id from the GID", async () => {
  const client = fakeClient([], [{ id: "gid://gitlab/Project/7", fullPath: "grp/a" }], {
    "grp/a:start": {
      project: {
        issues: page([
          issueNode("1", {
            assignees: {
              nodes: [
                { id: "gid://gitlab/User/42", username: "alice", name: "Alice" },
                { id: "gid://gitlab/User/43", username: "bob", name: "Bob" },
              ],
            },
          }),
        ]),
      },
    },
  });
  const issues = await fetchIssues(client);
  expect(issues[0].assignees).toEqual([
    { id: 42, username: "alice", name: "Alice" },
    { id: 43, username: "bob", name: "Bob" },
  ]);
});

test("follows cursor pagination within a project", async () => {
  const captured: Captured[] = [];
  const client = fakeClient(captured, [{ id: "gid://gitlab/Project/7", fullPath: "grp/big" }], {
    "grp/big:start": { project: { issues: page([issueNode("1")], true, "CURSOR_A") } },
    "grp/big:CURSOR_A": { project: { issues: page([issueNode("2")]) } },
  });

  const issues = await fetchIssues(client);

  expect(issues.map((i) => i.iid)).toEqual([1, 2]);
  const issueCalls = captured.filter((c) => !isProjectsQuery(c.query));
  expect(issueCalls[0].variables.after).toBeNull();
  expect(issueCalls[1].variables.after).toBe("CURSOR_A");
});

test("forwards `since` as ISO string and null when omitted", async () => {
  const projects = [{ id: "gid://gitlab/Project/1", fullPath: "grp/a" }];
  const pages = { "grp/a:start": { project: { issues: page([issueNode("1")]) } } };

  const c1: Captured[] = [];
  await fetchIssues(fakeClient(c1, projects, pages), new Date("2024-06-01T00:00:00.000Z"));
  expect(c1.find((c) => !isProjectsQuery(c.query))!.variables.since).toBe(
    "2024-06-01T00:00:00.000Z",
  );

  const c2: Captured[] = [];
  await fetchIssues(fakeClient(c2, projects, pages));
  expect(c2.find((c) => !isProjectsQuery(c.query))!.variables.since).toBeNull();
});

test("defaults null time fields to 0 in time_stats", async () => {
  const client = fakeClient([], [{ id: "gid://gitlab/Project/7", fullPath: "grp/a" }], {
    "grp/a:start": {
      project: { issues: page([issueNode("9", { timeEstimate: null, totalTimeSpent: null })]) },
    },
  });
  const issues = await fetchIssues(client);
  expect(issues[0].time_stats).toEqual({ time_estimate: 0, total_time_spent: 0 });
});

test("fetchProjects maps id from GID, fullPath and name", async () => {
  const client: GqlClient = {
    async gqlRequest() {
      return {
        projects: page([
          { id: "gid://gitlab/Project/123", fullPath: "acme/backend/api", name: "API" },
          { id: "gid://gitlab/Project/456", fullPath: "acme/frontend/web", name: "Web" },
        ]),
      };
    },
  };
  const projects = await fetchProjects(client);
  expect(projects).toEqual([
    { id: 123, fullPath: "acme/backend/api", name: "API" },
    { id: 456, fullPath: "acme/frontend/web", name: "Web" },
  ]);
});

test("tolerates an inaccessible project (project === null)", async () => {
  const client = fakeClient(
    [],
    [
      { id: "gid://gitlab/Project/1", fullPath: "grp/gone" },
      { id: "gid://gitlab/Project/2", fullPath: "grp/ok" },
    ],
    {
      "grp/gone:start": { project: null },
      "grp/ok:start": { project: { issues: page([issueNode("5")]) } },
    },
  );
  const issues = await fetchIssues(client);
  expect(issues.map((i) => i.iid)).toEqual([5]);
});
