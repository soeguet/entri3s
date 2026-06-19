import { test, expect, beforeEach } from "bun:test";
import { createTestDb } from "../repository/test-helper";
import { createRepository, type Repository } from "../repository";
import { createCommentService } from "./comment";
import { FakeGitLabClient, type GitLabComment } from "../gitlab/types";

let repo: Repository;
let gl: FakeGitLabClient;
let svc: ReturnType<typeof createCommentService>;

const PROJECT_ID = 42;

function seedTicket(iid: number): number {
  repo.tickets.upsert({
    gitlabIid: iid,
    gitlabGlobalId: 5000 + iid,
    projectId: PROJECT_ID,
    title: `Ticket ${iid}`,
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
  return repo.tickets.getByGitLabIid(iid, PROJECT_ID)!.id;
}

function note(noteId: number, updatedAt = "2024-06-17T10:00:00.000Z"): GitLabComment {
  return {
    noteId,
    discussionId: `disc-${noteId}`,
    authorUsername: "alice",
    authorName: "Alice",
    body: `body ${noteId}`,
    bodyHtml: `<p>body ${noteId}</p>`,
    system: false,
    createdAt: "2024-06-17T09:00:00.000Z",
    updatedAt,
  };
}

beforeEach(() => {
  repo = createRepository(createTestDb());
  gl = new FakeGitLabClient();
  svc = createCommentService(repo, gl);
  repo.projects.upsert({ id: PROJECT_ID, fullPath: "grp/a", name: "A" });
});

test("syncComments writes comments and a hash", async () => {
  const ticketId = seedTicket(7);
  gl.commentsToReturn = [note(1), note(2)];
  await svc.syncComments(ticketId);

  expect(svc.getComments(ticketId).map((c) => c.gitlabNoteId)).toEqual([1, 2]);
  expect(repo.tickets.getCommentsHash(ticketId)).not.toBeNull();
});

test("a second identical sync does not change the stored hash", async () => {
  const ticketId = seedTicket(7);
  gl.commentsToReturn = [note(1)];
  await svc.syncComments(ticketId);
  const firstHash = repo.tickets.getCommentsHash(ticketId);

  await svc.syncComments(ticketId);
  expect(repo.tickets.getCommentsHash(ticketId)).toBe(firstHash);
});

test("changed comments are written and update the hash", async () => {
  const ticketId = seedTicket(7);
  gl.commentsToReturn = [note(1)];
  await svc.syncComments(ticketId);
  const firstHash = repo.tickets.getCommentsHash(ticketId);

  gl.commentsToReturn = [note(1, "2024-06-18T10:00:00.000Z"), note(2)];
  await svc.syncComments(ticketId);

  expect(repo.tickets.getCommentsHash(ticketId)).not.toBe(firstHash);
  expect(svc.getComments(ticketId).map((c) => c.gitlabNoteId)).toEqual([1, 2]);
});

test("syncComments returns silently when the ticket does not exist", async () => {
  await svc.syncComments(9999);
  expect(svc.getComments(9999)).toEqual([]);
});

test("getImage builds a data URL from the fetched upload", async () => {
  gl.uploadToReturn = { contentType: "image/png", base64: "QUJD" };
  expect(await svc.getImage("/uploads/abc/bild.png")).toBe("data:image/png;base64,QUJD");
});

test("getImage rewrites the internal /-/project/<id>/uploads URL to the namespace route", async () => {
  repo.projects.upsert({ id: 5, fullPath: "acme/web", name: "Web" });
  gl.uploadToReturn = { contentType: "image/png", base64: "QUJD" };

  expect(await svc.getImage("/-/project/5/uploads/abc/image.png")).toBe(
    "data:image/png;base64,QUJD",
  );
  expect(gl.uploadCalls).toEqual(["/acme/web/uploads/abc/image.png"]);
});

test("getImage passes a non-matching URL through unchanged", async () => {
  gl.uploadToReturn = { contentType: "image/png", base64: "QUJD" };

  await svc.getImage("/uploads/abc/image.png");
  expect(gl.uploadCalls).toEqual(["/uploads/abc/image.png"]);
});

test("syncPinnedAndAssigned covers a pinned and an assigned ticket", async () => {
  const pinnedId = seedTicket(7);
  const assignedId = seedTicket(8);

  repo.tickets.pin(pinnedId);
  repo.settings.setCurrentUser({ id: 1, username: "me", name: "Me" });
  repo.tickets.setAssignees(assignedId, [{ gitlabUserId: 1, username: "me", name: "Me" }]);

  // GitLab-Note-IDs sind global eindeutig (UNIQUE-Constraint) — daher liefert der
  // Fake je Aufruf eine eigene Note (sonst kollidieren beide Tickets auf derselben
  // gitlab_note_id). Die Reihenfolge der Aufrufe ist hier nebensächlich.
  const queue = [[note(101)], [note(102)]];
  gl.fetchTicketComments = async () => queue.shift() ?? [];
  await svc.syncPinnedAndAssigned();

  expect(svc.getComments(pinnedId)).toHaveLength(1);
  expect(svc.getComments(assignedId)).toHaveLength(1);
});
