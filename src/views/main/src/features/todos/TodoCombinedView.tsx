import type { TodoList, TodoTask } from "../../../../../shared/types";
import { TodoList as TodoListView } from "./TodoList";

interface TodoCombinedViewProps {
  // Bereits aufbereitet (combinedLists.ts): je Liste die gefilterten/sortierten
  // Tasks, leere Listen ausgelassen.
  groups: Array<{ list: TodoList; tasks: TodoTask[] }>;
  selectedId: string | null;
  // ALLE Listennamen — für das Verschiebe-Menü in der Zeile.
  listNames: string[];
  errorTaskId: string | null;
  error: unknown;
  onSelect: (id: string) => void;
  onToggle: (task: TodoTask) => void;
  onRename: (task: TodoTask, title: string) => void;
  onReschedule: (task: TodoTask, due: string | null) => void;
  onMove: (task: TodoTask, toList: string) => void;
  onOpenDetail: (task: TodoTask) => void;
  onDelete: (task: TodoTask) => void;
  // Mehrfachauswahl: durchgereicht bis TodoRow (id+listId-basiert, listenübergreifend).
  selectMode: boolean;
  selectedIds: Set<string>;
  onSelectBulk: (task: TodoTask) => void;
}

// Kombinierter Modus (#7): alle Listen untereinander, je Liste ein Header (Name +
// offene Anzahl) und darunter die eigene <TodoList> mit den EIGENEN Sektionen der
// Liste. Reorder ist hier bewusst deaktiviert (reorderable=false): Cross-List-DnD
// bräuchte einen neuen Reorder-RPC mit from/to-Liste; Intra-Block-Reorder bräuchte
// nur listId-Durchreichung — beides bewusst out of scope. Detail/Move/Toggle/
// Delete/Datum sind task-/listId-gebunden und funktionieren listenübergreifend.
export function TodoCombinedView(props: TodoCombinedViewProps) {
  if (props.groups.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Keine Aufgaben.</p>;
  }
  return (
    <div className="space-y-6">
      {props.groups.map((group) => (
        <section key={group.list.id} aria-label={group.list.name}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">{group.list.name}</h2>
            <span className="text-xs text-muted-foreground">
              {group.tasks.filter((t) => !t.done).length}
            </span>
          </div>
          <TodoListView
            tasks={group.tasks}
            sections={group.list.sections}
            selectedId={props.selectedId}
            listNames={props.listNames}
            reorderable={false}
            errorTaskId={props.errorTaskId}
            error={props.error}
            onSelect={props.onSelect}
            onToggle={props.onToggle}
            onRename={props.onRename}
            onReschedule={props.onReschedule}
            onMove={props.onMove}
            onOpenDetail={props.onOpenDetail}
            onDelete={props.onDelete}
            onReorder={() => {}}
            selectMode={props.selectMode}
            selectedIds={props.selectedIds}
            onSelectBulk={props.onSelectBulk}
          />
        </section>
      ))}
    </div>
  );
}
