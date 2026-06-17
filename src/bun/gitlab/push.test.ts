import { test, expect } from "bun:test";
import type { ApiClient } from "./client";
import { bookTime, MAX_NOTE_LENGTH } from "./push";

interface Captured {
  path: string;
  options?: RequestInit;
}

function fakeClient(captured: Captured[]): ApiClient {
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

test("posts to the notes endpoint with a /spend quick action", async () => {
  const captured: Captured[] = [];
  await bookTime(fakeClient(captured), 7, 100, 90, "2024-06-17", "Login-Flow");

  expect(captured).toHaveLength(1);
  expect(captured[0].path).toBe("/projects/7/issues/100/notes");
  expect(captured[0].options?.method).toBe("POST");
  expect(body(captured)).toBe("/spend 1h 30m 2024-06-17\n\nLogin-Flow");
});

test("returns the note id and created_at from the response", async () => {
  const captured: Captured[] = [];
  const result = await bookTime(fakeClient(captured), 7, 100, 60, "2024-06-17", "x");
  expect(result).toEqual({ noteId: 302, createdAt: "2024-06-17T14:23:00.000Z" });
});

test("omits the comment line when there is no note text", async () => {
  const captured: Captured[] = [];
  await bookTime(fakeClient(captured), 7, 100, 120, "2024-06-17", "   ");
  expect(body(captured)).toBe("/spend 2h 2024-06-17");
});

test("truncates the note text to GitLab's 255 char limit", async () => {
  const captured: Captured[] = [];
  const long = "a".repeat(400);
  await bookTime(fakeClient(captured), 7, 100, 60, "2024-06-17", long);

  const text = body(captured).split("\n").slice(2).join("\n");
  expect(text).toHaveLength(MAX_NOTE_LENGTH);
});
