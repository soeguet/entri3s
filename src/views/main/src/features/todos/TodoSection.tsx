import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { TodoTask } from "../../../../../shared/types";
import { SectionHeader } from "../../components/SectionHeader";
import { TodoRow } from "./TodoRow";
import { reorderIntent } from "./reorderIntent";

interface TodoSectionProps {
  // null = Tasks ohne Sektion (kein Header).
  section: string | null;
  tasks: TodoTask[];
  selectedId: string | null;
  // ALLE Listennamen — für das Verschiebe-Menü in der Zeile.
  listNames: string[];
  // true in der konkreten Listenansicht: Rows werden per @dnd-kit sortierbar.
  reorderable: boolean;
  // id der Zeile, deren letzte Mutation fehlschlug (für inline-Konfliktanzeige).
  errorTaskId: string | null;
  error: unknown;
  onSelect: (id: string) => void;
  onToggle: (task: TodoTask) => void;
  onRename: (task: TodoTask, title: string) => void;
  onReschedule: (task: TodoTask, due: string | null) => void;
  onMove: (task: TodoTask, toList: string) => void;
  onOpenDetail: (task: TodoTask) => void;
  onReorder: (activeId: string, targetId: string, before: boolean) => void;
  // Einrück-Fähigkeit je Task-id (aus der globalen Reihenfolge berechnet).
  ability: Map<string, { canIndent: boolean; canOutdent: boolean }>;
  onReindent: (task: TodoTask, direction: "indent" | "outdent") => void;
  // Mehrfachauswahl: aktiviert die Auswahl-Checkbox je Zeile.
  selectMode: boolean;
  selectedIds: Set<string>;
  onSelectBulk: (task: TodoTask) => void;
}

export function TodoSection(props: TodoSectionProps) {
  // Sensoren auf oberster Ebene (Hook-Regel) — werden nur im reorderable-Zweig
  // verwendet.
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  if (props.tasks.length === 0) return null;

  const taskIds = props.tasks.map((t) => t.id);

  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over?.id;
    if (overId === undefined) return;
    const intent = reorderIntent(taskIds, String(event.active.id), String(overId));
    if (intent) props.onReorder(String(event.active.id), intent.targetId, intent.before);
  }

  const rows = props.tasks.map((task) => (
    <TodoRow
      key={task.id}
      task={task}
      selected={props.selectedId === task.id}
      sortable={props.reorderable}
      listNames={props.listNames}
      error={props.errorTaskId === task.id ? props.error : null}
      onSelect={() => props.onSelect(task.id)}
      onToggle={() => props.onToggle(task)}
      onRename={(title) => props.onRename(task, title)}
      onReschedule={(due) => props.onReschedule(task, due)}
      onMove={(toList) => props.onMove(task, toList)}
      onOpenDetail={() => props.onOpenDetail(task)}
      canIndent={props.ability.get(task.id)?.canIndent ?? false}
      canOutdent={props.ability.get(task.id)?.canOutdent ?? false}
      onReindent={(direction) => props.onReindent(task, direction)}
      selectMode={props.selectMode}
      selectedForBulk={props.selectedIds.has(task.id)}
      onSelectBulk={() => props.onSelectBulk(task)}
    />
  ));

  return (
    <div>
      {props.section !== null ? <SectionHeader>{props.section}</SectionHeader> : null}
      {props.reorderable ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            <div role="list">{rows}</div>
          </SortableContext>
        </DndContext>
      ) : (
        <div role="list">{rows}</div>
      )}
    </div>
  );
}
