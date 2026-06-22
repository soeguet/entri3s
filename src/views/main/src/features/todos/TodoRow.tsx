import { useRef, useState } from "react";
import { Calendar, FolderInput, Repeat } from "lucide-react";
import type { TodoTask } from "../../../../../shared/types";
import { cn } from "../../lib/utils";
import { Badge } from "../../components/ui/badge";
import { TodoDatePicker } from "./TodoDatePicker";
import { TodoMoveMenu } from "./TodoMoveMenu";
import { todoErrorMessage } from "./todoError";

interface TodoRowProps {
  task: TodoTask;
  selected: boolean;
  // ALLE Listennamen (inkl. der aktuellen) — zum Anbieten der Verschiebe-Ziele.
  listNames: string[];
  onSelect: () => void;
  onToggle: () => void;
  // Neuer Titel nach Blur (nur wenn geändert und nicht leer).
  onRename: (title: string) => void;
  onReschedule: (due: string | null) => void;
  onMove: (toList: string) => void;
  // Fehler der zuletzt versuchten Mutation auf GENAU diese Zeile (Konflikt).
  error: unknown;
}

// Priorität als kompaktes Emoji-Badge (Obsidian-Tasks-Konvention). "normal"
// zeigt kein Badge.
const PRIORITY_MARK: Record<TodoTask["priority"], string | null> = {
  highest: "🔺",
  high: "⏫",
  medium: "🔼",
  normal: null,
  low: "🔽",
  lowest: "⏬",
};

export function TodoRow(props: TodoRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(props.task.title);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const dateBtnRef = useRef<HTMLButtonElement>(null);
  const moveBtnRef = useRef<HTMLButtonElement>(null);

  // Verschiebe-Ziele: alle Listen außer der aktuellen. Button nur zeigen, wenn
  // es überhaupt eine andere Liste gibt.
  const moveTargets = props.listNames.filter((n) => n !== props.task.listId);

  // recurrenceEditableInApp === false → nicht abhakbar, Badge "in Obsidian abhaken".
  const readOnlyRecurrence = props.task.recurrence !== null && !props.task.recurrenceEditableInApp;
  const mark = PRIORITY_MARK[props.task.priority];

  function startEdit() {
    setDraft(props.task.title);
    setEditing(true);
  }
  // BLUR-ONLY: kein Speichern während des Tippens. Bei Konflikt bleibt die
  // Eingabe erhalten (der Aufrufer zeigt props.error inline, draft bleibt).
  function commitEdit() {
    setEditing(false);
    const next = draft.trim();
    if (next !== "" && next !== props.task.title) props.onRename(next);
  }

  return (
    <div
      role="listitem"
      aria-selected={props.selected}
      onClick={props.onSelect}
      style={{ paddingLeft: `${props.task.depth * 1.5 + 0.75}rem` }}
      className={cn(
        "flex items-center gap-2 border-b border-border py-1.5 pr-3 text-sm",
        props.selected && "bg-muted",
      )}
    >
      <input
        type="checkbox"
        checked={props.task.done}
        disabled={readOnlyRecurrence}
        aria-label={`${props.task.title} abhaken`}
        onChange={props.onToggle}
        onClick={(e) => e.stopPropagation()}
      />

      {editing ? (
        <input
          autoFocus
          aria-label="Titel bearbeiten"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") setEditing(false);
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 rounded border border-input bg-card px-2 py-0.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      ) : (
        <button
          type="button"
          onDoubleClick={startEdit}
          className={cn(
            "flex-1 truncate text-left",
            props.task.done && "text-muted-foreground line-through",
          )}
        >
          {mark ? <span className="mr-1">{mark}</span> : null}
          {props.task.title}
        </button>
      )}

      {props.task.tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="shrink-0">
          #{tag}
        </Badge>
      ))}

      {readOnlyRecurrence ? (
        <Badge variant="warning" className="shrink-0 gap-1">
          <Repeat className="h-3 w-3" />
          in Obsidian abhaken
        </Badge>
      ) : null}

      <button
        ref={dateBtnRef}
        type="button"
        aria-label="Datum / Reschedule"
        onClick={(e) => {
          e.stopPropagation();
          setPickerOpen(true);
        }}
        className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
      >
        <Calendar className="h-3 w-3" />
        {props.task.due ?? "—"}
      </button>

      <TodoDatePicker
        open={pickerOpen}
        anchor={dateBtnRef.current}
        due={props.task.due}
        onClose={() => setPickerOpen(false)}
        onPick={(due) => {
          setPickerOpen(false);
          props.onReschedule(due);
        }}
      />

      {moveTargets.length > 0 ? (
        <button
          ref={moveBtnRef}
          type="button"
          aria-label="In andere Liste verschieben"
          onClick={(e) => {
            e.stopPropagation();
            setMoveOpen(true);
          }}
          className="flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
        >
          <FolderInput className="h-3 w-3" />
        </button>
      ) : null}

      <TodoMoveMenu
        open={moveOpen}
        anchor={moveBtnRef.current}
        lists={moveTargets}
        onClose={() => setMoveOpen(false)}
        onMove={(toList) => {
          setMoveOpen(false);
          props.onMove(toList);
        }}
      />

      {props.error ? (
        <span className="shrink-0 text-xs text-danger-accent">{todoErrorMessage(props.error)}</span>
      ) : null}
    </div>
  );
}
