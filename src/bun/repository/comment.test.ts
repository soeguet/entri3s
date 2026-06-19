import { test, expect, beforeEach } from "bun:test";
import { createTestDb } from "./test-helper";
import { createRepository, type Repository } from "./index";
import type { TicketComment } from "../../shared/types";

let repo: Repository;
let ticketId: number;

const PROJECT_ID = 42;

beforeEach(() => {
  repo = createRepository(createTestDb());
  repo.projects.upsert({ id: PROJECT_ID, fullPath: "grp/a", name: "A" });
  repo.tickets.upsert({
    gitlabIid: 7,
    gitlabGlobalId: 5007,
    projectId: PROJECT_ID,
    title: "Ticket 7",
    state: "opened",
    timeEstimate: null,
    timeSpent: null,
    webUrl: null,
    notesCount: 0,
  });
  ticketId = repo.tickets.getByGitLabIid(7, PROJECT_ID)!.id;
});

function comment(
  noteId: number,
  createdAt: string,
  overrides: Partial<Omit<TicketComment, "id" | "ticketId">> = {},
): Omit<TicketComment, "id" | "ticketId"> {
  return {
    gitlabNoteId: noteId,
    authorUsername: "alice",
    authorName: "Alice",
    body: `body ${noteId}`,
    bodyHtml: `<p>body ${noteId}</p>`,
    isSystem: false,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

test("listForTicket returns comments ordered by created_at ASC", () => {
  repo.comments.replaceForTicket(ticketId, [
    comment(2, "2024-06-17T12:00:00.000Z"),
    comment(1, "2024-06-17T10:00:00.000Z"),
  ]);
  const list = repo.comments.listForTicket(ticketId);
  expect(list.map((c) => c.gitlabNoteId)).toEqual([1, 2]);
  expect(list[0].ticketId).toBe(ticketId);
  expect(list[0].isSystem).toBe(false);
});

test("maps is_system 1 back to a boolean", () => {
  repo.comments.replaceForTicket(ticketId, [
    comment(1, "2024-06-17T10:00:00.000Z", { isSystem: true }),
  ]);
  expect(repo.comments.listForTicket(ticketId)[0].isSystem).toBe(true);
});

test("replaceForTicket fully replaces the previous set", () => {
  repo.comments.replaceForTicket(ticketId, [
    comment(1, "2024-06-17T10:00:00.000Z"),
    comment(2, "2024-06-17T11:00:00.000Z"),
  ]);
  repo.comments.replaceForTicket(ticketId, [comment(3, "2024-06-17T12:00:00.000Z")]);

  const list = repo.comments.listForTicket(ticketId);
  expect(list.map((c) => c.gitlabNoteId)).toEqual([3]);
});
