import { describe, it, expect } from "vitest";
import type { Project } from "../../../../shared/types";
import { buildProjectTree, collectProjectIds } from "./projectTree";

function project(id: number, fullPath: string, name: string): Project {
  return { id, fullPath, name, syncedAt: null };
}

describe("buildProjectTree", () => {
  it("nests projects under their group segments", () => {
    const tree = buildProjectTree(
      [project(42, "acme/backend/api", "API"), project(43, "acme/backend/worker", "Worker")],
      new Map(),
    );

    expect(tree).toHaveLength(1);
    expect(tree[0].label).toBe("acme");
    const backend = tree[0].children[0];
    expect(backend.label).toBe("backend");
    expect(backend.children.map((c) => c.label)).toEqual(["API", "Worker"]);
    expect(backend.children.map((c) => c.projectId)).toEqual([42, 43]);
  });

  it("aggregates ticket counts up the group hierarchy", () => {
    const tree = buildProjectTree(
      [project(42, "acme/backend/api", "API"), project(44, "acme/frontend/web", "Web")],
      new Map([
        [42, 3],
        [44, 2],
      ]),
    );

    const acme = tree[0];
    expect(acme.ticketCount).toBe(5);
    const backend = acme.children.find((c) => c.label === "backend")!;
    expect(backend.ticketCount).toBe(3);
  });

  it("places a project without a group at the root", () => {
    const tree = buildProjectTree([project(1, "standalone", "Standalone")], new Map());
    expect(tree).toHaveLength(1);
    expect(tree[0].projectId).toBe(1);
    expect(tree[0].label).toBe("Standalone");
  });

  it("sorts groups before projects, each alphabetically", () => {
    const tree = buildProjectTree(
      [project(1, "z-proj", "Z Project"), project(2, "a-grp/inner", "Inner")],
      new Map(),
    );
    // Gruppe "a-grp" zuerst, dann das Wurzel-Projekt "Z Project".
    expect(tree.map((n) => n.label)).toEqual(["a-grp", "Z Project"]);
  });
});

describe("collectProjectIds", () => {
  it("gathers all project ids below a group node", () => {
    const tree = buildProjectTree(
      [project(42, "acme/backend/api", "API"), project(43, "acme/backend/worker", "Worker")],
      new Map(),
    );
    expect(collectProjectIds(tree[0]).sort()).toEqual([42, 43]);
  });

  it("returns a single id for a project leaf", () => {
    const tree = buildProjectTree([project(7, "grp/p", "P")], new Map());
    const leaf = tree[0].children[0];
    expect(collectProjectIds(leaf)).toEqual([7]);
  });
});
