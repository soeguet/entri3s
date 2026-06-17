import type { Project, Ticket } from "../../../../shared/types";
import { buildProjectTree, type ProjectTreeNode } from "./projectTree";

/**
 * Filterbaum-Knoten: erweitert den Projekt-/Gruppenbaum um Ticket-Blätter.
 * `ticketId` (+ `ticketIid` für die Anzeige) ist nur für Ticket-Blätter gesetzt;
 * `projectId`/`null` verhalten sich wie in ProjectTreeNode (Projektblatt/Gruppe).
 */
export interface FilterTreeNode {
  label: string;
  path: string;
  projectId: number | null;
  ticketId?: number;
  ticketIid?: number;
  ticketCount: number;
  children: FilterTreeNode[];
}

/**
 * Baut Gruppe → Projekt → Ticket. Nutzt buildProjectTree als Basis und hängt
 * unter jedes Projektblatt die zugehörigen Tickets als weitere Blätter.
 */
export function buildFilterTree(projects: Project[], tickets: Ticket[]): FilterTreeNode[] {
  const counts = new Map<number, number>();
  for (const t of tickets) counts.set(t.projectId, (counts.get(t.projectId) ?? 0) + 1);

  const ticketsByProject = new Map<number, Ticket[]>();
  for (const t of tickets) {
    const list = ticketsByProject.get(t.projectId) ?? [];
    list.push(t);
    ticketsByProject.set(t.projectId, list);
  }

  function decorate(node: ProjectTreeNode): FilterTreeNode {
    if (node.projectId === null) {
      return { ...node, children: node.children.map(decorate) };
    }
    const ownTickets = [...(ticketsByProject.get(node.projectId) ?? [])].sort(
      (a, b) => b.gitlabIid - a.gitlabIid,
    );
    const ticketChildren: FilterTreeNode[] = ownTickets.map((t) => ({
      label: `#${t.gitlabIid} ${t.title}`,
      path: `${node.path}#${t.id}`,
      projectId: null,
      ticketId: t.id,
      ticketIid: t.gitlabIid,
      ticketCount: 0,
      children: [],
    }));
    return { ...node, children: ticketChildren };
  }

  return buildProjectTree(projects, counts).map(decorate);
}

/** Alle Projekt-IDs unterhalb (und inklusive) eines Knotens (Tickets ignoriert). */
function collectProjectIdsFromFilter(node: FilterTreeNode): number[] {
  if (node.ticketId !== undefined) return [];
  if (node.projectId !== null) return [node.projectId];
  return node.children.flatMap(collectProjectIdsFromFilter);
}

/**
 * Löst eine Menge ausgewählter Knoten-Pfade in `{ projectIds, ticketIds }` auf.
 *   Gruppe angehakt  ⇒ alle Kind-Projekt-IDs
 *   Projekt angehakt ⇒ dessen projectId
 *   Ticket angehakt  ⇒ dessen ticketId
 * Doppelung vermeiden: Ist ein Projekt komplett gewählt, genügt seine projectId —
 * einzelne Tickets dieses Projekts werden nicht zusätzlich aufgenommen.
 */
export function resolveSelection(
  nodes: FilterTreeNode[],
  selected: Set<string>,
): { projectIds: number[]; ticketIds: number[] } {
  const projectIds = new Set<number>();
  const ticketIds = new Set<number>();

  function walk(node: FilterTreeNode): void {
    if (selected.has(node.path)) {
      for (const pid of collectProjectIdsFromFilter(node)) projectIds.add(pid);
      if (node.ticketId !== undefined) ticketIds.add(node.ticketId);
      // Tief absteigen ist unnötig: ganze Teilbäume sind über die
      // gesammelten Projekt-IDs abgedeckt.
      return;
    }
    for (const child of node.children) walk(child);
  }

  for (const node of nodes) walk(node);

  return { projectIds: [...projectIds], ticketIds: [...ticketIds] };
}
