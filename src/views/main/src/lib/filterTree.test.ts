import { describe, it, expect } from "vitest";
import type { Project, Ticket } from "../../../../shared/types";
import { buildFilterTree, resolveSelection } from "./filterTree";

function project(id: number, fullPath: string, name: string): Project {
  return { id, fullPath, name, syncedAt: null };
}

function ticket(id: number, projectId: number, gitlabIid: number): Ticket {
  return {
    id,
    gitlabIid,
    gitlabGlobalId: null,
    projectId,
    title: `Ticket ${gitlabIid}`,
    state: "opened",
    status: "active",
    timeEstimate: null,
    timeSpent: null,
    webUrl: null,
    assignees: [],
    description: null,
    descriptionHtml: null,
    labels: [],
    author: null,
    milestoneTitle: null,
    dueDate: null,
    issueCreatedAt: null,
    pinned: false,
    unread: false,
    lastViewedAt: null,
    notesCount: 0,
    syncedAt: null,
    createdAt: "",
    updatedAt: "",
  };
}

const projects = [
  project(42, "acme/backend/api", "API"),
  project(43, "acme/backend/worker", "Worker"),
];
const tickets = [ticket(1, 42, 101), ticket(2, 42, 102), ticket(3, 43, 201)];

describe("buildFilterTree", () => {
  it("hängt Tickets als Blätter unter ihr Projekt", () => {
    const tree = buildFilterTree(projects, tickets);
    const backend = tree[0].children[0];
    const api = backend.children.find((c) => c.projectId === 42)!;
    expect(api.children.map((c) => c.ticketId)).toEqual([2, 1]); // nach IID absteigend
    expect(api.children[0].ticketIid).toBe(102);
  });
});

describe("resolveSelection", () => {
  it("Gruppe angehakt ⇒ alle Kind-Projekt-IDs", () => {
    const tree = buildFilterTree(projects, tickets);
    const groupAcme = tree[0]; // "acme"
    const res = resolveSelection(tree, new Set([groupAcme.path]));
    expect(res.projectIds.sort()).toEqual([42, 43]);
    expect(res.ticketIds).toEqual([]);
  });

  it("Projekt angehakt ⇒ dessen projectId, keine Ticket-IDs", () => {
    const tree = buildFilterTree(projects, tickets);
    const api = tree[0].children[0].children.find((c) => c.projectId === 42)!;
    const res = resolveSelection(tree, new Set([api.path]));
    expect(res.projectIds).toEqual([42]);
    expect(res.ticketIds).toEqual([]);
  });

  it("Ticket angehakt ⇒ dessen ticketId", () => {
    const tree = buildFilterTree(projects, tickets);
    const api = tree[0].children[0].children.find((c) => c.projectId === 42)!;
    const ticketNode = api.children.find((c) => c.ticketId === 1)!;
    const res = resolveSelection(tree, new Set([ticketNode.path]));
    expect(res.projectIds).toEqual([]);
    expect(res.ticketIds).toEqual([1]);
  });

  it("keine Duplikate: gewähltes Projekt schluckt einzelne Tickets desselben Projekts", () => {
    const tree = buildFilterTree(projects, tickets);
    const api = tree[0].children[0].children.find((c) => c.projectId === 42)!;
    const ticketNode = api.children.find((c) => c.ticketId === 1)!;
    // Projekt UND ein Ticket darunter angehakt: das Ticket ist redundant.
    const res = resolveSelection(tree, new Set([api.path, ticketNode.path]));
    expect(res.projectIds).toEqual([42]);
    expect(res.ticketIds).toEqual([]);
  });

  it("leere Auswahl ⇒ leere Mengen", () => {
    const tree = buildFilterTree(projects, tickets);
    const res = resolveSelection(tree, new Set());
    expect(res).toEqual({ projectIds: [], ticketIds: [] });
  });
});
