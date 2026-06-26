import { test, expect } from "vitest";
import { resolveTargetList, shouldAutoDue } from "./quickAddList";

const LISTS = [{ id: "Arbeit" }, { id: "Privat" }, { id: "Arbeit 2026" }];

test("pickedListId hat Vorrang vor allem anderen", () => {
  expect(resolveTargetList("Privat", "Arbeit", LISTS, "Inbox")).toBe("Privat");
});

test("Exact-Match von listQuery gegen list.id (case-insensitive)", () => {
  expect(resolveTargetList(null, "privat", LISTS, "Inbox")).toBe("Privat");
  expect(resolveTargetList(null, "ARBEIT", LISTS, "Inbox")).toBe("Arbeit");
});

test("Match liefert IMMER die echte id, nie den rohen Token", () => {
  // Token "arbeit" → echte id "Arbeit" (Dateiname), nicht "arbeit".
  expect(resolveTargetList(null, "arbeit", LISTS, "Inbox")).toBe("Arbeit");
});

test("kein Match → Fallback", () => {
  expect(resolveTargetList(null, "Unbekannt", LISTS, "Inbox")).toBe("Inbox");
  expect(resolveTargetList(null, null, LISTS, "Inbox")).toBe("Inbox");
  expect(resolveTargetList(null, "Unbekannt", LISTS, null)).toBeNull();
});

test("Leerzeichen-Name 'Arbeit 2026' ist NICHT per Token auflösbar (nur via pickedId)", () => {
  // Token bricht am Whitespace ab → "Arbeit" matcht id "Arbeit", nicht "Arbeit 2026".
  expect(resolveTargetList(null, "Arbeit", LISTS, "Inbox")).toBe("Arbeit");
  // Per Auswahl (pickedListId) ist die Leerzeichen-Liste sehr wohl erreichbar.
  expect(resolveTargetList("Arbeit 2026", "Arbeit", LISTS, "Inbox")).toBe("Arbeit 2026");
});

test("shouldAutoDue-Matrix", () => {
  // Auto-due nur in 'today', ohne selektierte Liste, ohne explizite &Liste.
  expect(shouldAutoDue("today", null, false)).toBe(true);
  expect(shouldAutoDue("today", null, true)).toBe(false); // explizite Liste
  expect(shouldAutoDue("today", "Arbeit", false)).toBe(false); // selektierte Liste
  expect(shouldAutoDue("all", null, false)).toBe(false); // andere View
  expect(shouldAutoDue("upcoming", null, false)).toBe(false);
});
