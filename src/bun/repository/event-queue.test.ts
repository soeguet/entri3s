import { test, expect, beforeEach } from "bun:test";
import { createTestDb } from "./test-helper";
import { createEventQueueRepository } from "./event-queue";

let repo: ReturnType<typeof createEventQueueRepository>;

beforeEach(() => {
  repo = createEventQueueRepository(createTestDb());
});

test("enqueue → claimNext returns the event with parsed payload available", () => {
  repo.enqueue("booking", { entryId: 1 });
  const event = repo.claimNext();
  expect(event?.type).toBe("booking");
  expect(JSON.parse(event!.payload)).toEqual({ entryId: 1 });
});

test("claimNext returns null on empty queue", () => {
  expect(repo.claimNext()).toBeNull();
});

test("claimNext marks the event processing (not re-claimable)", () => {
  repo.enqueue("booking", {});
  expect(repo.claimNext()).not.toBeNull();
  expect(repo.claimNext()).toBeNull();
});

test("complete finishes the event", () => {
  repo.enqueue("booking", {});
  const event = repo.claimNext()!;
  repo.complete(event.id);
  expect(repo.claimNext()).toBeNull();
  expect(repo.listDead()).toHaveLength(0);
});

test("fail re-queues until 3 retries, then dead-letters", () => {
  repo.enqueue("booking", {});
  for (let i = 0; i < 3; i++) {
    const event = repo.claimNext();
    expect(event).not.toBeNull();
    repo.fail(event!.id, "boom");
  }
  expect(repo.claimNext()).toBeNull(); // jetzt dead, nicht mehr pending
  const dead = repo.listDead();
  expect(dead).toHaveLength(1);
  expect(dead[0].error).toBe("boom");
});

test("resetStuck moves processing back to pending", () => {
  repo.enqueue("booking", {});
  repo.claimNext(); // processing
  repo.resetStuck();
  expect(repo.claimNext()).not.toBeNull();
});

test("retryDead revives a dead event", () => {
  repo.enqueue("booking", {});
  for (let i = 0; i < 3; i++) repo.fail(repo.claimNext()!.id, "boom");
  const dead = repo.listDead();
  repo.retryDead(dead[0].id);
  expect(repo.claimNext()).not.toBeNull();
});

test("discardDead removes a dead event permanently", () => {
  repo.enqueue("booking_delete", {});
  for (let i = 0; i < 3; i++) repo.fail(repo.claimNext()!.id, "gone");
  const dead = repo.listDead();
  expect(dead).toHaveLength(1);

  repo.discardDead(dead[0].id);
  expect(repo.listDead()).toHaveLength(0);
  expect(repo.claimNext()).toBeNull(); // nicht wieder pending — endgültig weg
});

test("discardDead ignores a non-dead event", () => {
  repo.enqueue("booking", {});
  const event = repo.claimNext()!; // processing, nicht dead
  repo.discardDead(event.id);
  repo.resetStuck();
  expect(repo.claimNext()).not.toBeNull(); // unangetastet
});

test("discardDeadByEntry removes only the dead booking events of that entry", () => {
  repo.enqueue("booking", { entryId: 1 });
  repo.enqueue("booking", { entryId: 2 });
  for (let i = 0; i < 6; i++) repo.fail(repo.claimNext()!.id, "boom"); // beide → dead
  expect(repo.listDead()).toHaveLength(2);

  repo.discardDeadByEntry(1);

  const dead = repo.listDead();
  expect(dead).toHaveLength(1);
  expect(JSON.parse(repo.getDeadById(dead[0].id)!.payload).entryId).toBe(2);
});

test("counts returns zeros on an empty queue", () => {
  expect(repo.counts()).toEqual({ pending: 0, processing: 0, dead: 0 });
});

test("counts aggregates pending, processing and dead in one query", () => {
  // 2 pending bleiben unangetastet, 1 wird processing, 1 wird dead.
  repo.enqueue("a", {});
  repo.enqueue("b", {});
  repo.enqueue("c", {});
  const toProcess = repo.claimNext()!; // a → processing (FIFO: ältestes zuerst)
  expect(toProcess.type).toBe("a");
  const toFail = repo.claimNext()!; // b → processing
  for (let i = 0; i < 3; i++) repo.fail(toFail.id, "boom"); // b → dead nach 3 Fehlversuchen

  // Übrig: a=processing, b=dead, c=pending
  expect(repo.counts()).toEqual({ pending: 1, processing: 1, dead: 1 });
});
