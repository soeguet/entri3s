import { test, expect } from "vitest";
import { partialMatchKey, QueryClient } from "@tanstack/react-query";
import { keys } from "./queryKeys";

// keys.entries()/keys.tickets() ohne Argument müssen als Prefix gegen die
// gefilterten Query-Keys matchen — sonst greift invalidateQueries ins Leere.

test("keys.entries() matcht gefilterte entries-Keys als Prefix", () => {
  const filtered = keys.entries({ dateFrom: "2024-01-01T00:00:00.000Z" });
  expect(partialMatchKey(filtered, keys.entries())).toBe(true);
  expect(partialMatchKey(keys.entries(), keys.entries())).toBe(true);
});

test("keys.tickets() matcht gefilterte tickets-Keys als Prefix", () => {
  const filtered = keys.tickets({ status: "active" });
  expect(partialMatchKey(filtered, keys.tickets())).toBe(true);
});

test("keys.entries() trifft keine fremden Keys", () => {
  expect(partialMatchKey(keys.tickets({ status: "active" }), keys.entries())).toBe(false);
});

test("invalidateQueries({ keys.entries() }) markiert gefilterte Query als invalidated", async () => {
  const qc = new QueryClient();
  const filter = { dateFrom: "2024-01-01T00:00:00.000Z" };
  qc.setQueryData(keys.entries(filter), []);

  await qc.invalidateQueries({ queryKey: keys.entries() });

  const state = qc.getQueryState(keys.entries(filter));
  expect(state?.isInvalidated).toBe(true);
});

test("invalidateQueries({ keys.tickets() }) markiert gefilterte Query als invalidated", async () => {
  const qc = new QueryClient();
  const filter = { status: "active" as const };
  qc.setQueryData(keys.tickets(filter), []);

  await qc.invalidateQueries({ queryKey: keys.tickets() });

  const state = qc.getQueryState(keys.tickets(filter));
  expect(state?.isInvalidated).toBe(true);
});
