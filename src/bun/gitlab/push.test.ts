import { test, expect } from "bun:test";
import type { ApiClient } from "./client";
import { bookTime, findBookingNote, bookingMarker, MAX_NOTE_LENGTH } from "./push";

interface Captured {
  path: string;
  options?: RequestInit;
}

function postClient(captured: Captured[]): ApiClient {
  return {
    async apiRequest(path, options) {
      captured.push({ path, options });
      return new Response(JSON.stringify({ id: 302, created_at: "2024-06-17T14:23:00.000Z" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    },
  };
}

function body(captured: Captured[]): string {
  return JSON.parse(captured[0].options!.body as string).body;
}

const MARKER = bookingMarker(1);

test("posts to the notes endpoint with a /spend quick action and marker", async () => {
  const captured: Captured[] = [];
  await bookTime(postClient(captured), 7, 100, 90, "2024-06-17", "Login-Flow", MARKER);

  expect(captured).toHaveLength(1);
  expect(captured[0].path).toBe("/projects/7/issues/100/notes");
  expect(captured[0].options?.method).toBe("POST");
  expect(body(captured)).toBe(`/spend 1h 30m 2024-06-17\n\nLogin-Flow\n\n${MARKER}`);
});

test("returns the note id and created_at from the response", async () => {
  const captured: Captured[] = [];
  const result = await bookTime(postClient(captured), 7, 100, 60, "2024-06-17", "x", MARKER);
  expect(result).toEqual({ noteId: 302, createdAt: "2024-06-17T14:23:00.000Z" });
});

test("omits the comment line when there is no note text but keeps the marker", async () => {
  const captured: Captured[] = [];
  await bookTime(postClient(captured), 7, 100, 120, "2024-06-17", "   ", MARKER);
  expect(body(captured)).toBe(`/spend 2h 2024-06-17\n\n${MARKER}`);
});

test("truncates the note text to GitLab's 255 char limit", async () => {
  const captured: Captured[] = [];
  const long = "a".repeat(400);
  await bookTime(postClient(captured), 7, 100, 60, "2024-06-17", long, MARKER);

  const text = body(captured).split("\n")[2];
  expect(text).toHaveLength(MAX_NOTE_LENGTH);
});

test("bookingMarker is unique per entry", () => {
  expect(bookingMarker(1)).not.toBe(bookingMarker(2));
  expect(bookingMarker(42)).toContain("entry=42");
});

test("findBookingNote returns the matching note id, paginating as needed", async () => {
  const pages: Record<string, unknown[]> = {
    "1": [{ id: 1, created_at: "t1", body: "irrelevant" }],
    "2": [{ id: 9, created_at: "t9", body: `gebucht\n\n${MARKER}` }],
  };
  const client: ApiClient = {
    async apiRequest(path) {
      const page = new URL(`http://x${path}`).searchParams.get("page") ?? "1";
      return new Response(JSON.stringify(pages[page]), {
        status: 200,
        headers: { "Content-Type": "application/json", "x-total-pages": "2" },
      });
    },
  };
  expect(await findBookingNote(client, 7, 100, MARKER)).toEqual({ noteId: 9, createdAt: "t9" });
});

test("findBookingNote returns null when no note carries the marker", async () => {
  const client: ApiClient = {
    async apiRequest() {
      return new Response(JSON.stringify([{ id: 1, created_at: "t", body: "nope" }]), {
        status: 200,
        headers: { "Content-Type": "application/json", "x-total-pages": "1" },
      });
    },
  };
  expect(await findBookingNote(client, 7, 100, MARKER)).toBeNull();
});
