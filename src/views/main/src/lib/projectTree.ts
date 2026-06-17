import type { Project } from "../../../../shared/types";

/**
 * Knoten im Gruppen-/Projektbaum. Reines View-Modell (kein Domain-Typ) — leitet
 * sich aus den `fullPath`-Segmenten der Projekte ab:
 *   "acme/backend/api-service" → Gruppen "acme" › "backend", Projektblatt "api-service".
 */
export interface ProjectTreeNode {
  label: string; // Segment- bzw. Projektname
  path: string; // vollständiger Pfad bis zu diesem Knoten
  projectId: number | null; // gesetzt für Projektblätter, null für Gruppen
  ticketCount: number; // aggregierte Ticket-Anzahl über alle Nachfahren
  children: ProjectTreeNode[];
}

function findOrCreate(children: ProjectTreeNode[], label: string, path: string): ProjectTreeNode {
  const existing = children.find((c) => c.projectId === null && c.label === label);
  if (existing) return existing;
  const node: ProjectTreeNode = { label, path, projectId: null, ticketCount: 0, children: [] };
  children.push(node);
  return node;
}

function sortTree(nodes: ProjectTreeNode[]): void {
  // Gruppen vor Projekten, jeweils alphabetisch.
  nodes.sort((a, b) => {
    if ((a.projectId === null) !== (b.projectId === null)) return a.projectId === null ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
  for (const node of nodes) sortTree(node.children);
}

/**
 * Baut den Gruppen-/Projektbaum aus den Projekten. `counts` bildet projectId auf
 * die Anzahl der (gefilterten) Tickets ab; Gruppenknoten summieren ihre Nachfahren.
 */
export function buildProjectTree(
  projects: Project[],
  counts: Map<number, number>,
): ProjectTreeNode[] {
  const root: ProjectTreeNode[] = [];

  for (const project of projects) {
    const segments = project.fullPath.split("/").filter((s) => s.length > 0);
    const count = counts.get(project.id) ?? 0;

    // Alle Segmente bis auf das letzte sind Gruppen.
    let level = root;
    const groupSegments = segments.slice(0, -1);
    let pathSoFar = "";
    for (const segment of groupSegments) {
      pathSoFar = pathSoFar ? `${pathSoFar}/${segment}` : segment;
      const group = findOrCreate(level, segment, pathSoFar);
      group.ticketCount += count;
      level = group.children;
    }

    // Projektblatt: Anzeigename statt des Pfad-Segments.
    level.push({
      label: project.name,
      path: project.fullPath,
      projectId: project.id,
      ticketCount: count,
      children: [],
    });
  }

  sortTree(root);
  return root;
}

/** Alle Projekt-IDs unterhalb (und inklusive) eines Knotens — für Filterung. */
export function collectProjectIds(node: ProjectTreeNode): number[] {
  if (node.projectId !== null) return [node.projectId];
  return node.children.flatMap(collectProjectIds);
}
