import { test, expect, afterEach } from "bun:test";
import type { Settings } from "../../shared/types";
import { AppErrorError } from "../lib/app-error";
import { createGitLabClient } from "./client";

const settings: Settings = {
  gitlabUrl: "https://gl.example.com",
  syncIntervalSec: 300,
  todoFolder: "",
  todoRemindersEnabled: true,
};
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubFetch(impl: () => Promise<Response> | Response): void {
  globalThis.fetch = (async () => impl()) as unknown as typeof fetch;
}

/** Fängt den von fetchIssues geworfenen Fehler als AppErrorError ein. */
async function catchSyncError(): Promise<AppErrorError> {
  const client = createGitLabClient("token", () => settings);
  try {
    await client.fetchIssues();
    throw new Error("expected fetchIssues to throw");
  } catch (e) {
    expect(e).toBeInstanceOf(AppErrorError);
    return e as AppErrorError;
  }
}

test("maps a GraphQL errors[] body (HTTP 200) to AppError GITLAB_ERROR", async () => {
  stubFetch(() =>
    Response.json({ errors: [{ message: "Field 'issues' doesn't exist" }, { message: "boom" }] }),
  );
  const err = await catchSyncError();
  expect(err.code).toBe("GITLAB_ERROR");
  expect(err.message).toBe("Field 'issues' doesn't exist; boom");
  expect(err.retry).toBe(false);
});

test("maps HTTP 401 to AUTH_FAILED with the response body as message", async () => {
  stubFetch(() => new Response("401 Unauthorized", { status: 401 }));
  const err = await catchSyncError();
  expect(err.code).toBe("AUTH_FAILED");
  expect(err.message).toContain("401");
});

test("maps a fetch() network failure to NETWORK_ERROR (retryable)", async () => {
  stubFetch(() => {
    throw new TypeError("Unable to connect");
  });
  const err = await catchSyncError();
  expect(err.code).toBe("NETWORK_ERROR");
  expect(err.retry).toBe(true);
  expect(err.message).toContain("Unable to connect");
});

test("rejects an unconfigured gitlabUrl with NO_GITLAB_URL before any fetch", async () => {
  const client = createGitLabClient("token", () => ({
    gitlabUrl: "",
    syncIntervalSec: 300,
    todoFolder: "",
    todoRemindersEnabled: true,
  }));
  let threw: AppErrorError | null = null;
  try {
    await client.fetchIssues();
  } catch (e) {
    threw = e as AppErrorError;
  }
  expect(threw?.code).toBe("NO_GITLAB_URL");
});
