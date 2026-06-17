import { test, expect, beforeEach } from "bun:test";
import { createTestDb } from "../repository/test-helper";
import { createRepository, type Repository } from "../repository";
import { createSyncService } from "./sync";
import { FakeGitLabClient, type GitLabIssue } from "../gitlab/types";

let repo: Repository;
let gl: FakeGitLabClient;
let svc: ReturnType<typeof createSyncService>;

const PROJECT_ID = 42;

beforeEach(() => {
  repo = createRepository(createTestDb());
  gl = new FakeGitLabClient();
  svc = createSyncService(repo, gl);
});

function issue(iid: number, state: string): GitLabIssue {
  return {
    iid,
    title: `Issue ${iid}`,
    state,
    web_url: `https://gl/issues/${iid}`,
    updated_at: "2024-01-15T10:00:00.000Z",
    time_stats: { time_estimate: 3600, total_time_spent: 1800 },
  };
}

test("syncIssues upserts tickets and marks closed ones orphaned", async () => {
  gl.issuesToReturn = [issue(1, "opened"), issue(2, "closed")];
  const result = await svc.syncIssues(PROJECT_ID);

  expect(result.synced).toBe(2);
  expect(result.orphaned).toBe(1);

  const tickets = repo.tickets.list();
  expect(tickets).toHaveLength(2);
  expect(repo.tickets.getByGitLabIid(1, PROJECT_ID)?.status).toBe("active");
  expect(repo.tickets.getByGitLabIid(2, PROJECT_ID)?.status).toBe("orphaned");
});

test("syncIssues maps time stats", async () => {
  gl.issuesToReturn = [issue(1, "opened")];
  await svc.syncIssues(PROJECT_ID);
  const ticket = repo.tickets.getByGitLabIid(1, PROJECT_ID);
  expect(ticket?.timeEstimate).toBe(3600);
  expect(ticket?.timeSpent).toBe(1800);
});

test("syncIssues updates last_run", async () => {
  expect(repo.schedules.get("gitlab_sync")?.lastRun).toBeNull();
  gl.issuesToReturn = [issue(1, "opened")];
  await svc.syncIssues(PROJECT_ID);
  expect(repo.schedules.get("gitlab_sync")?.lastRun).not.toBeNull();
});

test("syncIssues reactivates a re-opened ticket that was orphaned", async () => {
  gl.issuesToReturn = [issue(1, "closed")];
  await svc.syncIssues(PROJECT_ID);
  expect(repo.tickets.getByGitLabIid(1, PROJECT_ID)?.status).toBe("orphaned");

  // Issue wird wieder geöffnet → Ticket muss wieder 'active' werden.
  gl.issuesToReturn = [issue(1, "opened")];
  await svc.syncIssues(PROJECT_ID);
  expect(repo.tickets.getByGitLabIid(1, PROJECT_ID)?.status).toBe("active");
});

test("checkOrphans marks tickets GitLab no longer returns", async () => {
  gl.issuesToReturn = [issue(1, "opened"), issue(2, "opened")];
  await svc.syncIssues(PROJECT_ID);

  // GitLab returns only issue 1 now → issue 2 becomes orphaned
  gl.issuesToReturn = [issue(1, "opened")];
  const orphaned = await svc.checkOrphans(PROJECT_ID);

  expect(orphaned).toBe(1);
  expect(repo.tickets.getByGitLabIid(2, PROJECT_ID)?.status).toBe("orphaned");
  expect(repo.tickets.getByGitLabIid(1, PROJECT_ID)?.status).toBe("active");
});
