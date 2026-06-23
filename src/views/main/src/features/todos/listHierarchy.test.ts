import { test, expect } from "vitest";
import type { TodoList } from "../../../../../shared/types";
import { breadcrumbLabel, childLabel, groupLists, splitListId } from "./listHierarchy";

function mkList(name: string): TodoList {
  return { id: name, name, tasks: [], sections: [] };
}

test("splitListId: no delimiter -> parent null, child = full name", () => {
  expect(splitListId("Inbox")).toEqual({ parent: null, child: "Inbox" });
});

test("splitListId: single delimiter splits into parent and child", () => {
  expect(splitListId("Arbeit~ProjektA")).toEqual({ parent: "Arbeit", child: "ProjektA" });
});

test("splitListId: multiple delimiters keep everything after the first in child", () => {
  expect(splitListId("a~b~c")).toEqual({ parent: "a", child: "b~c" });
});

test("groupLists: parent list with children forms one group", () => {
  const groups = groupLists([
    mkList("Arbeit"),
    mkList("Arbeit~ProjektA"),
    mkList("Arbeit~ProjektB"),
  ]);
  expect(groups).toHaveLength(1);
  expect(groups[0].parentName).toBe("Arbeit");
  expect(groups[0].parent?.name).toBe("Arbeit");
  expect(groups[0].children.map((c) => c.name)).toEqual(["Arbeit~ProjektA", "Arbeit~ProjektB"]);
});

test("groupLists: orphaned child still grouped under synthetic header", () => {
  const groups = groupLists([mkList("Arbeit~ProjektA")]);
  expect(groups).toHaveLength(1);
  expect(groups[0].parentName).toBe("Arbeit");
  expect(groups[0].parent).toBeNull();
  expect(groups[0].children.map((c) => c.name)).toEqual(["Arbeit~ProjektA"]);
});

test("groupLists: standalone list becomes a group with no children", () => {
  const groups = groupLists([mkList("Inbox")]);
  expect(groups).toHaveLength(1);
  expect(groups[0].parentName).toBe("Inbox");
  expect(groups[0].parent?.name).toBe("Inbox");
  expect(groups[0].children).toEqual([]);
});

test("groupLists: groups come back sorted by parentName", () => {
  const groups = groupLists([
    mkList("Zebra"),
    mkList("Arbeit~ProjektA"),
    mkList("Inbox"),
    mkList("Arbeit"),
  ]);
  expect(groups.map((g) => g.parentName)).toEqual(["Arbeit", "Inbox", "Zebra"]);
});

test("childLabel returns child segment or full name", () => {
  expect(childLabel("Arbeit~ProjektA")).toBe("ProjektA");
  expect(childLabel("Inbox")).toBe("Inbox");
});

test("breadcrumbLabel renders parent and child with ›, or full name", () => {
  expect(breadcrumbLabel("Arbeit~ProjektA")).toBe("Arbeit › ProjektA");
  expect(breadcrumbLabel("Inbox")).toBe("Inbox");
});
