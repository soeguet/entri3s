import { test, expect } from "bun:test";
import type { GqlClient } from "./client";
import type { TimelogTarget } from "./types";
import { createTimelog, findTimelog, deleteTimelog, MAX_SUMMARY_LENGTH } from "./timelog";

interface Captured {
  query: string;
  variables: Record<string, unknown>;
}

const TARGET: TimelogTarget = { projectId: 7, issueIid: 100, issueGlobalId: 9100 };

function client(
  captured: Captured[],
  respond: (vars: Record<string, unknown>) => unknown,
): GqlClient {
  return {
    async gqlRequest(query, variables) {
      captured.push({ query, variables });
      return respond(variables);
    },
  };
}

test("createTimelog calls timelogCreate with the issue GID, duration and summary", async () => {
  const captured: Captured[] = [];
  const gql = client(captured, () => ({
    timelogCreate: { timelog: { id: "gid://gitlab/Timelog/42" }, errors: [] },
  }));

  const id = await createTimelog(gql, TARGET, 90, "2024-06-17", "Login-Flow");

  expect(id).toBe(42);
  expect(captured[0].variables).toEqual({
    issuableId: "gid://gitlab/Issue/9100",
    timeSpent: "1h 30m",
    spentAt: "2024-06-17",
    summary: "Login-Flow",
  });
  // Keine Notes-/Kommentar-API: die Mutation heisst timelogCreate.
  expect(captured[0].query).toContain("timelogCreate");
});

test("createTimelog truncates the summary to the GitLab limit", async () => {
  const captured: Captured[] = [];
  const gql = client(captured, () => ({
    timelogCreate: { timelog: { id: "gid://gitlab/Timelog/1" }, errors: [] },
  }));

  await createTimelog(gql, TARGET, 60, "2024-06-17", "a".repeat(400));

  expect((captured[0].variables.summary as string).length).toBe(MAX_SUMMARY_LENGTH);
});

test("createTimelog throws when GitLab returns errors", async () => {
  const gql = client([], () => ({ timelogCreate: { timelog: null, errors: ["nope"] } }));
  await expect(createTimelog(gql, TARGET, 60, "2024-06-17", "x")).rejects.toThrow("nope");
});

test("findTimelog matches an identical timelog on the issue", async () => {
  const captured: Captured[] = [];
  const gql = client(captured, () => ({
    timelogs: {
      nodes: [
        {
          id: "gid://gitlab/Timelog/5",
          timeSpent: 5400,
          spentAt: "2024-06-17",
          summary: "Login-Flow",
          issue: { iid: "100" },
        },
        {
          id: "gid://gitlab/Timelog/6",
          timeSpent: 60,
          spentAt: "2024-06-17",
          summary: "anders",
          issue: { iid: "100" },
        },
      ],
    },
  }));

  const id = await findTimelog(gql, TARGET, 90, "2024-06-17", "Login-Flow");
  expect(id).toBe(5);
  expect(captured[0].variables.projectId).toBe("gid://gitlab/Project/7");
});

test("findTimelog ignores timelogs on other issues", async () => {
  const gql = client([], () => ({
    timelogs: {
      nodes: [
        {
          id: "gid://gitlab/Timelog/9",
          timeSpent: 5400,
          spentAt: "2024-06-17",
          summary: "Login-Flow",
          issue: { iid: "101" },
        },
      ],
    },
  }));
  expect(await findTimelog(gql, TARGET, 90, "2024-06-17", "Login-Flow")).toBeNull();
});

test("deleteTimelog calls timelogDelete with the timelog GID", async () => {
  const captured: Captured[] = [];
  const gql = client(captured, () => ({
    timelogDelete: { timelog: { id: "gid://gitlab/Timelog/42" }, errors: [] },
  }));

  await deleteTimelog(gql, 42);
  expect(captured[0].variables.id).toBe("gid://gitlab/Timelog/42");
  expect(captured[0].query).toContain("timelogDelete");
});

test("deleteTimelog tolerates an already-deleted timelog", async () => {
  const gql = client([], () => ({
    timelogDelete: { timelog: null, errors: ["Timelog not found"] },
  }));
  await expect(deleteTimelog(gql, 42)).resolves.toBeUndefined();
});

test("deleteTimelog throws on a real error", async () => {
  const gql = client([], () => ({ timelogDelete: { timelog: null, errors: ["unauthorized"] } }));
  await expect(deleteTimelog(gql, 42)).rejects.toThrow("unauthorized");
});
