import { test, expect } from "vitest";
import { renderGitlabHtml } from "./gitlabHtml";

test("unpacks a gl-emoji custom element to its inner unicode content", () => {
  expect(renderGitlabHtml('<gl-emoji data-name="smile">😄</gl-emoji>')).toBe("😄");
});

test("unpacks multiple gl-emoji elements inside surrounding HTML", () => {
  const input = '<p>Hi <gl-emoji data-name="wave">👋</gl-emoji> and <gl-emoji>🚀</gl-emoji></p>';
  expect(renderGitlabHtml(input)).toBe("<p>Hi 👋 and 🚀</p>");
});

test("leaves normal HTML untouched", () => {
  const input = '<p>Body <strong>md</strong> <a href="/x">link</a></p>';
  expect(renderGitlabHtml(input)).toBe(input);
});

test("returns an empty string unchanged", () => {
  expect(renderGitlabHtml("")).toBe("");
});
