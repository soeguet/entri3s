import type { SmartView } from "./smartViewFilter";

// Reine, testbare Helfer für die `&Liste`-Zuweisung im Quick-Add (#6).
// Bewusst getrennt von der UI: Resolution und Auto-due-Entscheidung sollen je
// EINE testbare Stelle sein, statt über zwei Komponenten verstreut.

/**
 * Ziel-Liste auflösen. Liefert IMMER eine echte list.id (= Dateiname) zurück,
 * nie den rohen Token — sonst legt das Backend in einer falschen Datei an.
 * Vorrang:
 *  1. pickedListId (vom Dropdown gewählt) — autoritativ (Listennamen können
 *     Leerzeichen enthalten, daher ist der getippte Token nur eine Filter-Query).
 *  2. Exact-Match (case-insensitive) von listQuery gegen lists[].id.
 *  3. fallback (heutiges Verhalten: selektierte/erste Liste).
 */
export function resolveTargetList(
  pickedListId: string | null,
  listQuery: string | null,
  lists: { id: string }[],
  fallback: string | null,
): string | null {
  if (pickedListId !== null) return pickedListId;
  if (listQuery !== null) {
    const q = listQuery.toLowerCase();
    const hit = lists.find((l) => l.id.toLowerCase() === q);
    if (hit) return hit.id;
  }
  return fallback;
}

/**
 * Auto-due (#2): in der Heute-Ansicht ohne explizite Liste bekommt ein neuer
 * Task automatisch due=heute, sonst landet er außerhalb der Smart-View. Eine
 * EXPLIZIT gewählte Liste (pickedListId ODER listQuery-Match) unterdrückt das.
 * Einzige Stelle für diese Entscheidung — von useTodoActions.onAdd genutzt.
 */
export function shouldAutoDue(
  view: SmartView,
  selectedList: string | null,
  hadExplicitList: boolean,
): boolean {
  return view === "today" && selectedList === null && !hadExplicitList;
}
