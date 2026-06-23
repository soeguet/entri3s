import type { TodoTask } from "../../../../../shared/types";
import { TodoSection } from "./TodoSection";
import { reindentAbility } from "./reindentAbility";

interface TodoListProps {
  // Die bereits durch die Smart-View gefilterten Tasks, die angezeigt werden.
  tasks: TodoTask[];
  // Sektions-Reihenfolge (aus der Liste; Smart-Views "Alle" kennen mehrere
  // Listen → dann ist sections leer und es wird nur nach Sektionsname gruppiert).
  sections: string[];
  selectedId: string | null;
  // ALLE Listennamen — für das Verschiebe-Menü in der Zeile.
  listNames: string[];
  // true nur in der konkreten Listenansicht (nicht in Smart-Views): aktiviert DnD.
  reorderable: boolean;
  errorTaskId: string | null;
  error: unknown;
  onSelect: (id: string) => void;
  onToggle: (task: TodoTask) => void;
  onRename: (task: TodoTask, title: string) => void;
  onReschedule: (task: TodoTask, due: string | null) => void;
  onMove: (task: TodoTask, toList: string) => void;
  onOpenDetail: (task: TodoTask) => void;
  onReorder: (activeId: string, targetId: string, before: boolean) => void;
  // Einrücken/Ausrücken eines Tasks (nur in der reorderable-Ansicht sinnvoll).
  onReindent: (task: TodoTask, direction: "indent" | "outdent") => void;
  // Mehrfachauswahl: durchgereicht bis TodoRow.
  selectMode: boolean;
  selectedIds: Set<string>;
  onSelectBulk: (task: TodoTask) => void;
}

// Gruppiert Tasks nach Sektion (definierte Reihenfolge zuerst, dann unbekannte
// Sektionen in Vorkommens-Reihenfolge, zuletzt sektionslose Tasks).
function groupBySection(tasks: TodoTask[], sections: string[]): Array<[string | null, TodoTask[]]> {
  const known = sections.filter((s) => tasks.some((t) => t.section === s));
  const extra = [
    ...new Set(
      tasks.map((t) => t.section).filter((s): s is string => s !== null && !sections.includes(s)),
    ),
  ];
  const groups: Array<[string | null, TodoTask[]]> = [];
  for (const name of [...known, ...extra]) {
    groups.push([name, tasks.filter((t) => t.section === name)]);
  }
  const sectionless = tasks.filter((t) => t.section === null);
  if (sectionless.length > 0) groups.push([null, sectionless]);
  return groups;
}

export function TodoList(props: TodoListProps) {
  if (props.tasks.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Keine Aufgaben.</p>;
  }
  // Aus der VOLLEN geordneten Liste (vor dem Section-Grouping) — canIndent hängt
  // vom globalen, unmittelbaren Vorgänger ab, nicht von der Section-Gruppe.
  const ability = reindentAbility(props.tasks);
  const groups = groupBySection(props.tasks, props.sections);
  return (
    <div className="rounded-lg border border-border bg-card">
      {groups.map(([section, tasks]) => (
        <TodoSection
          key={section ?? "__none__"}
          section={section}
          tasks={tasks}
          selectedId={props.selectedId}
          listNames={props.listNames}
          reorderable={props.reorderable}
          errorTaskId={props.errorTaskId}
          error={props.error}
          onSelect={props.onSelect}
          onToggle={props.onToggle}
          onRename={props.onRename}
          onReschedule={props.onReschedule}
          onMove={props.onMove}
          onOpenDetail={props.onOpenDetail}
          onReorder={props.onReorder}
          ability={ability}
          onReindent={props.onReindent}
          selectMode={props.selectMode}
          selectedIds={props.selectedIds}
          onSelectBulk={props.onSelectBulk}
        />
      ))}
    </div>
  );
}
