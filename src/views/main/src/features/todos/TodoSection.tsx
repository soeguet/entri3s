import type { TodoTask } from "../../../../../shared/types";
import { SectionHeader } from "../../components/SectionHeader";
import { TodoRow } from "./TodoRow";

interface TodoSectionProps {
  // null = Tasks ohne Sektion (kein Header).
  section: string | null;
  tasks: TodoTask[];
  selectedId: string | null;
  // id der Zeile, deren letzte Mutation fehlschlug (für inline-Konfliktanzeige).
  errorTaskId: string | null;
  error: unknown;
  onSelect: (id: string) => void;
  onToggle: (task: TodoTask) => void;
  onRename: (task: TodoTask, title: string) => void;
  onReschedule: (task: TodoTask, due: string | null) => void;
}

export function TodoSection(props: TodoSectionProps) {
  if (props.tasks.length === 0) return null;
  return (
    <div>
      {props.section !== null ? <SectionHeader>{props.section}</SectionHeader> : null}
      <div role="list">
        {props.tasks.map((task) => (
          <TodoRow
            key={task.id}
            task={task}
            selected={props.selectedId === task.id}
            error={props.errorTaskId === task.id ? props.error : null}
            onSelect={() => props.onSelect(task.id)}
            onToggle={() => props.onToggle(task)}
            onRename={(title) => props.onRename(task, title)}
            onReschedule={(due) => props.onReschedule(task, due)}
          />
        ))}
      </div>
    </div>
  );
}
