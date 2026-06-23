import { test, expect } from "vitest";
import { parseQuickAdd } from "./parseQuickAdd";

const today = "2026-06-22"; // Montag

test("priority tokens map to TodoPriority (ohne @)", () => {
  expect(parseQuickAdd("x p1", today).priority).toBe("highest");
  expect(parseQuickAdd("x p2", today).priority).toBe("high");
  expect(parseQuickAdd("x p3", today).priority).toBe("medium");
  expect(parseQuickAdd("x p4", today).priority).toBe("low");
  expect(parseQuickAdd("x", today).priority).toBe("normal");
});

test("collects and dedups #tags (ohne @)", () => {
  const result = parseQuickAdd("x #a #b #a", today);
  expect(result.tags).toEqual(["a", "b"]);
  expect(result.title).toBe("x");
});

test("relative @-keyword dates", () => {
  expect(parseQuickAdd("x @heute", today).due).toBe("2026-06-22");
  expect(parseQuickAdd("x @morgen", today).due).toBe("2026-06-23");
  expect(parseQuickAdd("x @übermorgen", today).due).toBe("2026-06-24");
});

test("@-weekday long and short forms, inkl. @so (Sonntag)", () => {
  expect(parseQuickAdd("x @mittwoch", today).due).toBe("2026-06-24");
  expect(parseQuickAdd("x @mi", today).due).toBe("2026-06-24");
  expect(parseQuickAdd("x @montag", today).due).toBe("2026-06-22");
  expect(parseQuickAdd("x @mo", today).due).toBe("2026-06-22");
  expect(parseQuickAdd("x @sonntag", today).due).toBe("2026-06-28");
  expect(parseQuickAdd("x @so", today).due).toBe("2026-06-28");
});

test("@nächste woche and @wochenende", () => {
  expect(parseQuickAdd("x @nächste woche", today).due).toBe("2026-06-29");
  expect(parseQuickAdd("x @wochenende", today).due).toBe("2026-06-27");
});

test("explicit German and ISO @-dates", () => {
  expect(parseQuickAdd("x @1.7.", today).due).toBe("2026-07-01");
  expect(parseQuickAdd("x @1.7.2027", today).due).toBe("2027-07-01");
  expect(parseQuickAdd("x @2026-12-31", today).due).toBe("2026-12-31");
});

test("@-date strips only the token (inkl. @) aus dem Titel", () => {
  const result = parseQuickAdd("Angebot @morgen schreiben", today);
  expect(result.title).toBe("Angebot schreiben");
  expect(result.due).toBe("2026-06-23");
  expect(result.title).not.toContain("@");
});

test("@nächste woche entfernt das Multiword-Token komplett", () => {
  const result = parseQuickAdd("Planung @nächste woche machen", today);
  expect(result.due).toBe("2026-06-29");
  expect(result.title).toBe("Planung machen");
});

test("ohne @ wird KEIN Datum erkannt – Wort bleibt im Titel", () => {
  for (const word of ["so", "morgen", "montag", "heute", "wochenende"]) {
    const result = parseQuickAdd(`mach es ${word}`, today);
    expect(result.due).toBeNull();
    expect(result.title).toBe(`mach es ${word}`);
  }
});

test("bloßes Datum ohne @ bleibt Teil des Titels", () => {
  const result = parseQuickAdd("Termin 1.7. Uhr", today);
  expect(result.due).toBeNull();
  expect(result.title).toBe("Termin 1.7. Uhr");
});

test("pure title without tokens is trimmed", () => {
  const result = parseQuickAdd("Einkaufen gehen ", today);
  expect(result.title).toBe("Einkaufen gehen");
  expect(result.due).toBeNull();
  expect(result.tags).toEqual([]);
  expect(result.priority).toBe("normal");
});

test("protection rule: lone token keeps raw as title", () => {
  const result = parseQuickAdd("p1", today);
  expect(result.title).toBe("p1");
  expect(result.priority).toBe("normal");
  expect(result.due).toBeNull();
  expect(result.tags).toEqual([]);
});

test("protection rule: lone @-date keeps raw as title", () => {
  const result = parseQuickAdd("@morgen", today);
  expect(result.title).toBe("@morgen");
  expect(result.due).toBeNull();
  expect(result.priority).toBe("normal");
  expect(result.tags).toEqual([]);
});

test("first @-date wins, second date word stays in title", () => {
  const result = parseQuickAdd("x @heute @morgen", today);
  expect(result.due).toBe("2026-06-22");
  expect(result.title).toContain("@morgen");
});

test("full example combines title, due, tags, priority", () => {
  const result = parseQuickAdd("Angebot schreiben @morgen #arbeit p1", today);
  expect(result.title).toBe("Angebot schreiben");
  expect(result.due).toBe("2026-06-23");
  expect(result.tags).toEqual(["arbeit"]);
  expect(result.priority).toBe("highest");
});
