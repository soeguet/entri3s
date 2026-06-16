import { test, expect, beforeEach } from "bun:test";
import { createTestDb } from "../repository/test-helper";
import { createRepository, type Repository } from "../repository";
import { createBookingService } from "../service/booking";
import { FakeGitLabClient } from "../gitlab/types";
import { processNext } from "./worker";
import type { AppEmitter } from "../app/emitter";

let repo: Repository;
let gl: FakeGitLabClient;
let events: string[];
let emit: AppEmitter;

const PROJECT_ID = 7;

function makeEmitter(): AppEmitter {
  return {
    bookingCompleted: () => events.push("bookingCompleted"),
    bookingFailed: () => events.push("bookingFailed"),
    syncCompleted: () => events.push("syncCompleted"),
    syncFailed: () => events.push("syncFailed"),
    orphanDetected: () => events.push("orphanDetected"),
  };
}

function seedBooking(): number {
  repo.tickets.upsert({
    gitlabIid: 100,
    projectId: PROJECT_ID,
    title: "Ticket",
    state: "opened",
    timeEstimate: null,
    timeSpent: null,
    webUrl: null,
  });
  const ticket = repo.tickets.getByGitLabIid(100, PROJECT_ID)!;
  const entryId = repo.entries.create({
    title: "Work",
    notes: null,
    durationMinutes: 90,
    date: "2024-01-15T10:00:00.000Z",
    status: "draft",
    tagIds: [],
    ticketIds: [ticket.id],
  });
  createBookingService(repo).bookEntry(entryId);
  return entryId;
}

beforeEach(() => {
  repo = createRepository(createTestDb());
  gl = new FakeGitLabClient();
  events = [];
  emit = makeEmitter();
});

test("processNext returns false on empty queue", async () => {
  expect(await processNext(repo, gl, emit)).toBe(false);
});

test("booking event books time and marks entry booked", async () => {
  const entryId = seedBooking();
  expect(repo.entries.getById(entryId)?.status).toBe("pending_booking");

  const processed = await processNext(repo, gl, emit);

  expect(processed).toBe(true);
  expect(gl.bookedCalls).toHaveLength(1);
  expect(gl.bookedCalls[0]).toMatchObject({
    projectId: PROJECT_ID,
    issueIid: 100,
    durationMinutes: 90,
  });
  expect(repo.entries.getById(entryId)?.status).toBe("booked");
  expect(events).toContain("bookingCompleted");
  expect(await processNext(repo, gl, emit)).toBe(false); // queue leer
});

test("failing booking retries and dead-letters after 3 attempts", async () => {
  const entryId = seedBooking();
  gl.bookShouldThrow = new Error("GitLab down");

  await processNext(repo, gl, emit);
  await processNext(repo, gl, emit);
  await processNext(repo, gl, emit);

  expect(await processNext(repo, gl, emit)).toBe(false); // dead, nicht mehr pending
  expect(repo.eventQueue.listDead()).toHaveLength(1);
  expect(repo.entries.getById(entryId)?.status).toBe("pending_booking"); // nie gebucht
  expect(events.filter((e) => e === "bookingFailed")).toHaveLength(3);
});
