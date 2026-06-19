import { test, expect, beforeEach } from "bun:test";
import { createTestDb } from "../repository/test-helper";
import { createRepository, type Repository } from "../repository";
import { createSyncService } from "./sync";
import { noopEmitter } from "../app/emitter";
import { FakeGitLabClient, type GitLabIssue } from "../gitlab/types";

let repo: Repository;
let gl: FakeGitLabClient;
let svc: ReturnType<typeof createSyncService>;

const PROJECT_ID = 42;

beforeEach(() => {
  repo = createRepository(createTestDb());
  gl = new FakeGitLabClient();
  svc = createSyncService(repo, gl, noopEmitter);
});

function issue(
  iid: number,
  state: string,
  assignees: GitLabIssue["assignees"] = [],
  userNotesCount = 0,
): GitLabIssue {
  return {
    iid,
    globalId: 5000 + iid,
    project_id: PROJECT_ID,
    title: `Issue ${iid}`,
    state,
    web_url: `https://gl/issues/${iid}`,
    updated_at: "2024-01-15T10:00:00.000Z",
    userNotesCount,
    assignees,
    time_stats: { time_estimate: 3600, total_time_spent: 1800 },
    description: `Body ${iid}`,
    descriptionHtml: `<p>Body ${iid}</p>`,
    labels: [{ title: "bug", color: "#ff0000" }],
    author: { username: "alice", name: "Alice" },
    milestoneTitle: "Sprint 1",
    dueDate: "2024-02-01",
    issueCreatedAt: "2024-01-01T08:00:00.000Z",
  };
}

test("syncIssues persists project metadata from GitLab", async () => {
  gl.projectsToReturn = [
    { id: 42, fullPath: "acme/backend/api", name: "API" },
    { id: 43, fullPath: "acme/frontend/web", name: "Web" },
  ];
  gl.issuesToReturn = [issue(1, "opened")];
  await svc.syncIssues();

  const projects = repo.projects.list();
  expect(projects).toHaveLength(2);
  expect(repo.projects.getById(42)?.fullPath).toBe("acme/backend/api");
});

test("syncIssues upserts tickets and marks closed ones orphaned", async () => {
  gl.issuesToReturn = [issue(1, "opened"), issue(2, "closed")];
  const result = await svc.syncIssues();

  expect(result.synced).toBe(2);
  expect(result.orphaned).toBe(1);

  const tickets = repo.tickets.list();
  expect(tickets).toHaveLength(2);
  expect(repo.tickets.getByGitLabIid(1, PROJECT_ID)?.status).toBe("active");
  expect(repo.tickets.getByGitLabIid(2, PROJECT_ID)?.status).toBe("orphaned");
});

test("syncIssues maps time stats and the global issue id", async () => {
  gl.issuesToReturn = [issue(1, "opened")];
  await svc.syncIssues();
  const ticket = repo.tickets.getByGitLabIid(1, PROJECT_ID);
  expect(ticket?.timeEstimate).toBe(3600);
  expect(ticket?.timeSpent).toBe(1800);
  expect(ticket?.gitlabGlobalId).toBe(5001);
});

test("syncIssues persists the user notes count", async () => {
  gl.issuesToReturn = [issue(1, "opened", [], 7)];
  await svc.syncIssues();
  expect(repo.tickets.getByGitLabIid(1, PROJECT_ID)?.notesCount).toBe(7);
});

test("syncIssues persists issue metadata and round-trips labels JSON", async () => {
  gl.issuesToReturn = [issue(1, "opened")];
  await svc.syncIssues();
  const ticket = repo.tickets.getByGitLabIid(1, PROJECT_ID);
  expect(ticket?.description).toBe("Body 1");
  expect(ticket?.descriptionHtml).toBe("<p>Body 1</p>");
  expect(ticket?.labels).toEqual([{ title: "bug", color: "#ff0000" }]);
  expect(ticket?.author).toEqual({ username: "alice", name: "Alice" });
  expect(ticket?.milestoneTitle).toBe("Sprint 1");
  expect(ticket?.dueDate).toBe("2024-02-01");
  expect(ticket?.issueCreatedAt).toBe("2024-01-01T08:00:00.000Z");
});

test("syncIssues tolerates missing issue metadata (null author/milestone/labels)", async () => {
  const bare = issue(1, "opened");
  bare.description = null;
  bare.descriptionHtml = null;
  bare.labels = [];
  bare.author = null;
  bare.milestoneTitle = null;
  bare.dueDate = null;
  gl.issuesToReturn = [bare];
  await svc.syncIssues();
  const ticket = repo.tickets.getByGitLabIid(1, PROJECT_ID);
  expect(ticket?.description).toBeNull();
  expect(ticket?.descriptionHtml).toBeNull();
  expect(ticket?.labels).toEqual([]);
  expect(ticket?.author).toBeNull();
  expect(ticket?.milestoneTitle).toBeNull();
  expect(ticket?.dueDate).toBeNull();
});

test("syncIssues updates last_run", async () => {
  expect(repo.schedules.get("gitlab_sync")?.lastRun).toBeNull();
  gl.issuesToReturn = [issue(1, "opened")];
  await svc.syncIssues();
  expect(repo.schedules.get("gitlab_sync")?.lastRun).not.toBeNull();
});

test("syncIssues reactivates a re-opened ticket that was orphaned", async () => {
  gl.issuesToReturn = [issue(1, "closed")];
  await svc.syncIssues();
  expect(repo.tickets.getByGitLabIid(1, PROJECT_ID)?.status).toBe("orphaned");

  // Issue wird wieder geöffnet → Ticket muss wieder 'active' werden.
  gl.issuesToReturn = [issue(1, "opened")];
  await svc.syncIssues();
  expect(repo.tickets.getByGitLabIid(1, PROJECT_ID)?.status).toBe("active");
});

test("checkOrphans marks tickets GitLab no longer returns", async () => {
  gl.issuesToReturn = [issue(1, "opened"), issue(2, "opened")];
  await svc.syncIssues();

  // GitLab returns only issue 1 now → issue 2 becomes orphaned
  gl.issuesToReturn = [issue(1, "opened")];
  const orphaned = await svc.checkOrphans();

  expect(orphaned).toBe(1);
  expect(repo.tickets.getByGitLabIid(2, PROJECT_ID)?.status).toBe("orphaned");
  expect(repo.tickets.getByGitLabIid(1, PROJECT_ID)?.status).toBe("active");
});

test("syncIssues persists the current user", async () => {
  gl.issuesToReturn = [issue(1, "opened")];
  await svc.syncIssues();
  expect(repo.settings.getCurrentUser()).toEqual({
    id: 1,
    username: "testuser",
    name: "Test User",
  });
});

test("syncIssues persists assignees of an issue", async () => {
  gl.issuesToReturn = [
    issue(1, "opened", [
      { id: 7, username: "alice", name: "Alice" },
      { id: 8, username: "bob", name: "Bob" },
    ]),
  ];
  await svc.syncIssues();

  const ticket = repo.tickets.getByGitLabIid(1, PROJECT_ID);
  expect(ticket?.assignees).toEqual([
    { gitlabUserId: 7, username: "alice", name: "Alice" },
    { gitlabUserId: 8, username: "bob", name: "Bob" },
  ]);
});

test("syncIssues does not overwrite an existing current user", async () => {
  repo.settings.setCurrentUser({ id: 99, username: "existing", name: "Existing User" });
  gl.currentUser = { id: 1, username: "testuser", name: "Test User" };
  gl.issuesToReturn = [issue(1, "opened")];
  await svc.syncIssues();
  expect(repo.settings.getCurrentUser()).toEqual({
    id: 99,
    username: "existing",
    name: "Existing User",
  });
});
