import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isSelfWrite, mutateFile, rememberSelfWrite } from "./mutate";
import { hashContent } from "./vault";

let dir: string;
let file: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "todos-mutate-"));
  file = join(dir, "Inbox.md");
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("mutateFile relocates by fingerprint and edits only that line", async () => {
  writeFileSync(file, "- [ ] one\n- [ ] two\n- [ ] three\n");
  await mutateFile("Inbox", file, "- [ ] two", (parsed, idx) => {
    const lines = [...parsed.lines];
    lines[idx] = "- [x] two";
    return lines;
  });
  expect(readFileSync(file, "utf8")).toBe("- [ ] one\n- [x] two\n- [ ] three\n");
});

test("FAIL-CLOSED: zero fingerprint matches -> TODO_CONFLICT", async () => {
  writeFileSync(file, "- [ ] one\n- [ ] two\n");
  await expect(mutateFile("Inbox", file, "- [ ] missing", (p) => p.lines)).rejects.toMatchObject({
    code: "TODO_CONFLICT",
  });
});

test("FAIL-CLOSED: duplicate fingerprint (>1 match) -> TODO_CONFLICT", async () => {
  writeFileSync(file, "- [ ] dup\n- [ ] dup\n");
  await expect(mutateFile("Inbox", file, "- [ ] dup", (p) => p.lines)).rejects.toMatchObject({
    code: "TODO_CONFLICT",
  });
});

test("mutateFile registers self-write hash for suppression", async () => {
  writeFileSync(file, "- [ ] a\n");
  await mutateFile("Inbox", file, "- [ ] a", (parsed, idx) => {
    const lines = [...parsed.lines];
    lines[idx] = "- [x] a";
    return lines;
  });
  const after = readFileSync(file, "utf8");
  expect(isSelfWrite(file, hashContent(after))).toBe(true);
  expect(isSelfWrite(file, hashContent("something else"))).toBe(false);
});

test("rememberSelfWrite tracks the last hash per file", () => {
  rememberSelfWrite("/x", "h1");
  expect(isSelfWrite("/x", "h1")).toBe(true);
  rememberSelfWrite("/x", "h2");
  expect(isSelfWrite("/x", "h1")).toBe(false);
  expect(isSelfWrite("/x", "h2")).toBe(true);
});
