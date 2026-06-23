import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileForList, listMd, read, sanitizeListName, writeAtomic } from "./vault";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "todos-vault-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("sanitizeListName rejects path traversal and separators", () => {
  expect(() => sanitizeListName("../evil")).toThrow();
  expect(() => sanitizeListName("a/b")).toThrow();
  expect(() => sanitizeListName("a\\b")).toThrow();
  expect(() => sanitizeListName("")).toThrow();
  expect(() => sanitizeListName("   ")).toThrow();
});

test("sanitizeListName accepts normal names with unicode", () => {
  expect(sanitizeListName("Inbox")).toBe("Inbox");
  expect(sanitizeListName("Arbeit 2026")).toBe("Arbeit 2026");
  expect(sanitizeListName("Übung_1-foo")).toBe("Übung_1-foo");
});

test("fileForList stays inside dir (no traversal)", () => {
  const f = fileForList(dir, "Inbox");
  expect(f).toBe(join(dir, "Inbox.md"));
  expect(() => fileForList(dir, "../escape")).toThrow();
});

test("listMd returns names without extension", () => {
  writeFileSync(join(dir, "Inbox.md"), "");
  writeFileSync(join(dir, "Work.md"), "");
  writeFileSync(join(dir, "ignore.txt"), "");
  expect(listMd(dir).sort()).toEqual(["Inbox", "Work"]);
});

test("writeAtomic writes content and returns its hash; round trips through read", async () => {
  const f = join(dir, "Inbox.md");
  const content = "- [ ] hello\n";
  const hash = writeAtomic(f, content);
  expect(readFileSync(f, "utf8")).toBe(content);
  const r = await read(f);
  expect(r.content).toBe(content);
  expect(r.hash).toBe(hash);
});

test("writeAtomic leaves no temp files behind", async () => {
  const f = join(dir, "Inbox.md");
  writeAtomic(f, "x");
  const leftovers = listMd(dir);
  expect(leftovers).toEqual(["Inbox"]);
});
