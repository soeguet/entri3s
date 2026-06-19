import { test, expect } from "vitest";
import type { TicketComment } from "../../../../../shared/types";
import { groupByDiscussion } from "./groupByDiscussion";

function comment(
  id: number,
  discussionId: string,
  createdAt: string,
  overrides: Partial<TicketComment> = {},
): TicketComment {
  return {
    id,
    ticketId: 1,
    gitlabNoteId: 5000 + id,
    discussionId,
    authorUsername: "u",
    authorName: "U",
    body: `body ${id}`,
    bodyHtml: `<p>body ${id}</p>`,
    isSystem: false,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

test("gruppiert Notes derselben Discussion zusammen", () => {
  const groups = groupByDiscussion([
    comment(1, "a", "2024-01-15T09:00:00.000Z"),
    comment(2, "a", "2024-01-15T10:00:00.000Z"),
    comment(3, "b", "2024-01-15T11:00:00.000Z"),
  ]);
  expect(groups).toHaveLength(2);
  expect(groups[0].discussionId).toBe("a");
  expect(groups[0].notes.map((n) => n.id)).toEqual([1, 2]);
  expect(groups[1].notes.map((n) => n.id)).toEqual([3]);
});

test("ordnet Discussions chronologisch nach der frühesten Note", () => {
  const groups = groupByDiscussion([
    comment(3, "late", "2024-01-15T12:00:00.000Z"),
    comment(1, "early", "2024-01-15T08:00:00.000Z"),
    comment(2, "early", "2024-01-15T09:00:00.000Z"),
  ]);
  expect(groups.map((g) => g.discussionId)).toEqual(["early", "late"]);
});

test("sortiert Notes innerhalb einer Discussion aufsteigend nach createdAt", () => {
  const groups = groupByDiscussion([
    comment(2, "a", "2024-01-15T10:00:00.000Z"),
    comment(1, "a", "2024-01-15T09:00:00.000Z"),
  ]);
  expect(groups[0].notes.map((n) => n.id)).toEqual([1, 2]);
});

test("Altbestand ohne discussionId verschmilzt nicht zu einer Gruppe", () => {
  const groups = groupByDiscussion([
    comment(1, "", "2024-01-15T09:00:00.000Z"),
    comment(2, "", "2024-01-15T10:00:00.000Z"),
  ]);
  expect(groups).toHaveLength(2);
});

test("mutiert das Eingangs-Array nicht", () => {
  const input = [
    comment(2, "a", "2024-01-15T10:00:00.000Z"),
    comment(1, "a", "2024-01-15T09:00:00.000Z"),
  ];
  const before = input.map((c) => c.id);
  groupByDiscussion(input);
  expect(input.map((c) => c.id)).toEqual(before);
});
