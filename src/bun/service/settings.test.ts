import { test, expect, mock } from "bun:test";
// keytar lädt ein natives .node-Modul (libsecret), das in der CI/Testumgebung
// fehlt → das keytar-Modul selbst mocken, bevor keychain.ts es importiert.
mock.module("keytar", () => ({
  setPassword: async () => {},
  getPassword: async () => null,
  deletePassword: async () => true,
}));

import { createTestDb } from "../repository/test-helper";
import { createRepository } from "../repository";
import { FakeGitLabClient } from "../gitlab/types";

test("setToken clears the DB current user and invalidates the in-memory client cache", async () => {
  // Dynamischer Import NACH mock.module: statische Imports werden gehoistet und
  // würden keychain.ts → keytar (natives Modul) vor dem Mock laden.
  const { createSettingsService } = await import("./settings");

  const db = createTestDb();
  const repo = createRepository(db);
  const gl = new FakeGitLabClient();
  const svc = createSettingsService(repo, db, gl);

  repo.settings.setCurrentUser({ id: 5, username: "x", name: "X" });
  await svc.setToken("new-token");

  expect(repo.settings.getCurrentUser()).toBeNull();
  expect(gl.clearCurrentUserCacheCalls).toBe(1);
});
