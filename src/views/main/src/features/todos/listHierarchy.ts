import type { TodoList } from "../../../../../shared/types";

// Sub-Listen per Namenskonvention: ein Listenname "Parent~Child" bildet genau
// EINE Hierarchie-Ebene. Der Delimiter ist hier die einzige Quelle der Wahrheit;
// nirgends sonst hardcoden.
export const LIST_DELIMITER = "~";

// Split am ERSTEN Delimiter. Mehrere Delimiter -> alles nach dem ersten gehört
// zum Child (kein Grandchild-Parsing): "a~b~c" -> { parent: "a", child: "b~c" }.
export function splitListId(id: string): { parent: string | null; child: string } {
  const idx = id.indexOf(LIST_DELIMITER);
  if (idx === -1) return { parent: null, child: id };
  return { parent: id.slice(0, idx), child: id.slice(idx + LIST_DELIMITER.length) };
}

export interface ListGroup {
  parentName: string;
  parent: TodoList | null;
  children: TodoList[];
}

// Gruppiert Listen nach dem Parent-Segment (Teil vor dem ersten Delimiter).
// Standalone-Listen, Parent-Listen mit Kindern und verwaiste Kinder (Parent-Liste
// existiert nicht) teilen sich denselben parentName-Key und landen in einer Gruppe.
export function groupLists(lists: TodoList[]): ListGroup[] {
  const byParent = new Map<string, ListGroup>();

  const groupFor = (parentName: string): ListGroup => {
    let group = byParent.get(parentName);
    if (!group) {
      group = { parentName, parent: null, children: [] };
      byParent.set(parentName, group);
    }
    return group;
  };

  for (const list of lists) {
    const { parent, child } = splitListId(list.name);
    if (parent === null) {
      // Standalone-Liste ist potenziell die Parent-Liste ihres eigenen Namens.
      groupFor(child).parent = list;
    } else {
      groupFor(parent).children.push(list);
    }
  }

  const groups = [...byParent.values()];
  for (const group of groups) {
    group.children.sort((a, b) => a.name.localeCompare(b.name));
  }
  groups.sort((a, b) => a.parentName.localeCompare(b.parentName));
  return groups;
}

// Nur das Child-Segment (ohne Parent-Präfix). Ohne Delimiter = voller Name.
export function childLabel(id: string): string {
  return splitListId(id).child;
}

// "Parent › Child" wenn ein Parent existiert, sonst der volle Name.
export function breadcrumbLabel(id: string): string {
  const { parent, child } = splitListId(id);
  return parent === null ? child : `${parent} › ${child}`;
}
