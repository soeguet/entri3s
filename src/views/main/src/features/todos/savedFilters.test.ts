import { test, expect } from "vitest";
import { EMPTY_FILTER } from "./taskFilterSort";
import { parseSavedFilters, serializeSavedFilters, type SavedFilter } from "./savedFilters";

test("parseSavedFilters('') -> []", () => {
  expect(parseSavedFilters("")).toEqual([]);
  expect(parseSavedFilters("   ")).toEqual([]);
});

test("parseSavedFilters ignoriert ungültigen/nicht-Array JSON", () => {
  expect(parseSavedFilters("{ not json")).toEqual([]);
  expect(parseSavedFilters('{"a":1}')).toEqual([]);
});

test("round-trip serialize -> parse", () => {
  const list: SavedFilter[] = [
    {
      id: "1",
      name: "Backend offen",
      view: "all",
      listId: null,
      filter: { ...EMPTY_FILTER, tags: ["backend"], status: "open" },
      sort: "priority",
    },
    {
      id: "2",
      name: "Arbeit",
      view: null,
      listId: "Arbeit",
      filter: EMPTY_FILTER,
      sort: "manual",
    },
  ];
  expect(parseSavedFilters(serializeSavedFilters(list))).toEqual(list);
});
