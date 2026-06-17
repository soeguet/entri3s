import { test, expect, beforeEach } from "bun:test";
import { createTestDb } from "./test-helper";
import { createRepository, type Repository } from "./index";

let repo: Repository;

beforeEach(() => {
  repo = createRepository(createTestDb());
});

test("upsert inserts a new project", () => {
  repo.projects.upsert({ id: 42, fullPath: "acme/backend/api", name: "API" });
  const project = repo.projects.getById(42);
  expect(project?.fullPath).toBe("acme/backend/api");
  expect(project?.name).toBe("API");
  expect(project?.syncedAt).not.toBeNull();
});

test("upsert updates path and name on conflict", () => {
  repo.projects.upsert({ id: 42, fullPath: "acme/old", name: "Old" });
  repo.projects.upsert({ id: 42, fullPath: "acme/new", name: "New" });
  expect(repo.projects.list()).toHaveLength(1);
  expect(repo.projects.getById(42)?.fullPath).toBe("acme/new");
  expect(repo.projects.getById(42)?.name).toBe("New");
});

test("list returns projects ordered by full_path", () => {
  repo.projects.upsert({ id: 2, fullPath: "z/proj", name: "Z" });
  repo.projects.upsert({ id: 1, fullPath: "a/proj", name: "A" });
  expect(repo.projects.list().map((p) => p.id)).toEqual([1, 2]);
});

test("getById returns null when unknown", () => {
  expect(repo.projects.getById(999)).toBeNull();
});
