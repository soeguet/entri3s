import { test, expect } from "bun:test";
import { resolveUploadUrl, projectUploadApiPath } from "./upload";

const BASE = "https://gitlab.example.com";

test("resolveUploadUrl resolves a relative /uploads path against the base", () => {
  expect(resolveUploadUrl(BASE, "/uploads/abc/bild.png")).toBe(
    "https://gitlab.example.com/uploads/abc/bild.png",
  );
  expect(resolveUploadUrl(BASE, "/-/project/1/uploads/abc/bild.png")).toBe(
    "https://gitlab.example.com/-/project/1/uploads/abc/bild.png",
  );
});

test("resolveUploadUrl normalises a trailing slash in the base", () => {
  expect(resolveUploadUrl("https://gitlab.example.com/", "/uploads/x.png")).toBe(
    "https://gitlab.example.com/uploads/x.png",
  );
});

test("resolveUploadUrl allows an absolute same-origin url", () => {
  expect(resolveUploadUrl(BASE, "https://gitlab.example.com/uploads/y.png")).toBe(
    "https://gitlab.example.com/uploads/y.png",
  );
});

test("resolveUploadUrl rejects a cross-origin absolute url (token protection)", () => {
  expect(resolveUploadUrl(BASE, "https://evil.example.com/uploads/y.png")).toBeNull();
  // Different port is also a different origin.
  expect(resolveUploadUrl(BASE, "https://gitlab.example.com:8443/uploads/y.png")).toBeNull();
});

test("resolveUploadUrl returns null for an empty or invalid gitlabUrl", () => {
  expect(resolveUploadUrl("", "/uploads/x.png")).toBeNull();
  expect(resolveUploadUrl("   ", "/uploads/x.png")).toBeNull();
  expect(resolveUploadUrl("not-a-url", "/uploads/x.png")).toBeNull();
});

test("resolveUploadUrl returns null for an unparseable src", () => {
  expect(resolveUploadUrl(BASE, "http://[bad")).toBeNull();
});

test("projectUploadApiPath maps the internal /-/project URL to the REST path", () => {
  expect(projectUploadApiPath("/-/project/5/uploads/72ee06abc/image.png")).toBe(
    "/projects/5/uploads/72ee06abc/image.png",
  );
});

test("projectUploadApiPath returns null for non-matching URLs", () => {
  expect(projectUploadApiPath("/uploads/abc/x.png")).toBeNull();
  expect(projectUploadApiPath("/uploads/-/system/personal_snippet/1/abc/x.png")).toBeNull();
  expect(projectUploadApiPath("https://host/uploads/abc/x.png")).toBeNull();
  expect(projectUploadApiPath("/-/project/abc/uploads/x.png")).toBeNull();
});
