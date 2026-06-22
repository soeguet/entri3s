import { test, expect, beforeEach } from "bun:test";
import { createTestDb } from "../repository/test-helper";
import { createRepository, type Repository } from "../repository";
import { FakeGitLabClient } from "../gitlab/types";
import type { GitLabCommit } from "../gitlab/types";
import { AppErrorError } from "../lib/app-error";
import { createCommitService } from "./commit";

let repo: Repository;
let gl: FakeGitLabClient;

const PROJECT_A = 10;
const PROJECT_B = 20;
const PROJECT_C = 30;

function seedProject(id: number, name: string): void {
  repo.projects.upsert({ id, fullPath: `group/${name}`, name });
}

function seedTicket(projectId: number, gitlabIid: number): number {
  repo.tickets.upsert({
    gitlabIid,
    gitlabGlobalId: gitlabIid * 100,
    projectId,
    title: `Ticket #${gitlabIid}`,
    state: "opened",
    timeEstimate: null,
    timeSpent: null,
    webUrl: null,
    notesCount: 0,
    description: null,
    descriptionHtml: null,
    authorUsername: null,
    authorName: null,
    milestoneTitle: null,
    labels: [],
    dueDate: null,
    issueCreatedAt: null,
  });
  return repo.tickets.getByGitLabIid(gitlabIid, projectId)!.id;
}

function seedEntry(date: string, ticketIds: number[]): number {
  return repo.entries.create({
    notes: null,
    durationMinutes: 60,
    date,
    status: "draft",
    tagIds: [],
    ticketIds,
  });
}

function fakeCommit(id: string, createdAt: string): GitLabCommit {
  return {
    id,
    short_id: id.slice(0, 8),
    title: `Commit ${id}`,
    author_name: "Test User",
    created_at: createdAt,
    web_url: `https://gitlab.example.com/commit/${id}`,
  };
}

beforeEach(() => {
  repo = createRepository(createTestDb());
  gl = new FakeGitLabClient();
});

test("narrows to projects of tickets attached to entries of the queried day", () => {
  seedProject(PROJECT_A, "alpha");
  seedProject(PROJECT_B, "beta");
  seedProject(PROJECT_C, "charlie");

  const ticketA = seedTicket(PROJECT_A, 1);
  const ticketB = seedTicket(PROJECT_B, 2);
  seedTicket(PROJECT_C, 3); // not attached to any entry

  seedEntry("2024-06-10T08:00:00Z", [ticketA, ticketB]);

  const commitA = fakeCommit("aaa1111111111111111111111111111111111111", "2024-06-10T10:00:00Z");
  const commitB = fakeCommit("bbb2222222222222222222222222222222222222", "2024-06-10T09:00:00Z");
  gl.commitsToReturn = [commitA, commitB];

  const svc = createCommitService(repo, gl);
  const result = svc.getForDate("2024-06-10");

  return result.then((commits) => {
    // Only projects A and B queried, NOT C
    expect(gl.commitCalls.sort()).toEqual([PROJECT_A, PROJECT_B].sort());
    expect(commits).toHaveLength(4); // 2 commits per project * 2 projects
    // Verify projectId mapping
    const projectIds = [...new Set(commits.map((c) => c.projectId))].sort();
    expect(projectIds).toEqual([PROJECT_A, PROJECT_B]);
    // Verify sort order (createdAt DESC)
    expect(commits[0].createdAt).toBe("2024-06-10T10:00:00Z");
    expect(commits[1].createdAt).toBe("2024-06-10T10:00:00Z");
    expect(commits[2].createdAt).toBe("2024-06-10T09:00:00Z");
    expect(commits[3].createdAt).toBe("2024-06-10T09:00:00Z");
  });
});

test("falls back to projects from all entries when queried day has no ticket-entries", () => {
  seedProject(PROJECT_A, "alpha");
  seedProject(PROJECT_B, "beta");

  const ticketA = seedTicket(PROJECT_A, 1);

  // Entry on a DIFFERENT day with ticket in project A
  seedEntry("2024-06-05T08:00:00Z", [ticketA]);
  // Entry on queried day WITHOUT tickets
  seedEntry("2024-06-10T08:00:00Z", []);

  gl.commitsToReturn = [];

  const svc = createCommitService(repo, gl);
  return svc.getForDate("2024-06-10").then(() => {
    // Fallback 1: project A from the other day's ticket
    expect(gl.commitCalls).toEqual([PROJECT_A]);
  });
});

test("caps queried projects to maxProjects", () => {
  seedProject(PROJECT_A, "alpha");
  seedProject(PROJECT_B, "beta");
  seedProject(PROJECT_C, "charlie");

  const ticketA = seedTicket(PROJECT_A, 1);
  const ticketB = seedTicket(PROJECT_B, 2);
  const ticketC = seedTicket(PROJECT_C, 3);

  seedEntry("2024-06-10T08:00:00Z", [ticketA, ticketB, ticketC]);

  gl.commitsToReturn = [];

  // Cap at 2 projects
  const svc = createCommitService(repo, gl, { maxProjects: 2 });
  return svc.getForDate("2024-06-10").then(() => {
    expect(gl.commitCalls).toHaveLength(2);
  });
});

test("throws AppError with code TIMEOUT when budget is exceeded", async () => {
  seedProject(PROJECT_A, "alpha");
  const ticketA = seedTicket(PROJECT_A, 1);
  seedEntry("2024-06-10T08:00:00Z", [ticketA]);

  gl.commitsHang = true;

  const svc = createCommitService(repo, gl, { budgetMs: 10 });
  try {
    await svc.getForDate("2024-06-10");
    expect.unreachable("should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(AppErrorError);
    const err = e as AppErrorError;
    expect(err.code).toBe("TIMEOUT");
    expect(err.retry).toBe(true);
  }
});

test("returns empty array without calling fetchCommits when no projects found", async () => {
  // No projects, no tickets, no entries at all
  const svc = createCommitService(repo, gl);
  const commits = await svc.getForDate("2024-06-10");
  expect(commits).toEqual([]);
  expect(gl.commitCalls).toHaveLength(0);
});
