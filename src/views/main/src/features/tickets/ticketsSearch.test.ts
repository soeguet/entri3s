import { test, expect } from "vitest";
import { ticketsSearchSchema } from "./ticketsSearch";

test("defaults: leere URL → status=active, sortBy=iid desc, Rest leer/false", () => {
  const parsed = ticketsSearchSchema.parse({});
  expect(parsed).toEqual({
    status: "active",
    state: "",
    search: "",
    selectedPath: null,
    assignedToMe: false,
    pinnedOnly: false,
    unreadOnly: false,
    sortBy: "iid",
    sortDir: "desc",
  });
});

test("gesetzte Search-Params werden korrekt geparst", () => {
  const parsed = ticketsSearchSchema.parse({
    status: "orphaned",
    state: "closed",
    search: "login",
    selectedPath: "group/project",
    assignedToMe: true,
    pinnedOnly: true,
    unreadOnly: true,
    sortBy: "title",
    sortDir: "asc",
  });
  expect(parsed.status).toBe("orphaned");
  expect(parsed.search).toBe("login");
  expect(parsed.selectedPath).toBe("group/project");
  expect(parsed.assignedToMe).toBe(true);
  expect(parsed.sortBy).toBe("title");
  expect(parsed.sortDir).toBe("asc");
});
