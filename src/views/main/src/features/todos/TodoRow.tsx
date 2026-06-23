import { useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar,
  FolderInput,
  GripVertical,
  ListIndentDecrease,
  ListIndentIncrease,
  PanelRight,
  Repeat,
  StickyNote,
} from "lucide-react";
import type { TodoTask } from "../../../../../shared/types";
import { cn } from "../../lib/utils";
import { Badge } from "../../components/ui/badge";
import { TodoDatePicker } from "./TodoDatePicker";
import { TodoMoveMenu } from "./TodoMoveMenu";
import { todoErrorMessage } from "./todoError";

interface TodoRowProps {
  task: TodoTask;
  selected: boolean;
  // true in der konkreten Listenansicht: zeigt einen Drag-Handle und macht die
  // Zeile per @dnd-kit sortierbar. false (Default) in Smart-Views — heutiges
  // Verhalten unverändert.
  sortable?: boolean;
  // ALLE Listennamen (inkl. der aktuellen) — zum Anbieten der Verschiebe-Ziele.
  listNames: string[];
  onSelect: () => void;
  onToggle: () => void;
  // Neuer Titel nach Blur (nur wenn geändert und nicht leer).
  onRename: (title: string) => void;
  onReschedule: (due: string | null) => void;
  onMove: (toList: string) => void;
  // Öffnet das Detail-Panel für diese Zeile.
  onOpenDetail: () => void;
  // Fehler der zuletzt versuchten Mutation auf GENAU diese Zeile (Konflikt).
  error: unknown;
  // Mehrfachauswahl-Modus: zeigt GANZ LINKS eine zusätzliche Auswahl-Checkbox
  // (getrennt von der done-Checkbox). Default false → Verhalten wie bisher.
  selectMode?: boolean;
  selectedForBulk?: boolean;
  onSelectBulk?: () => void;
  // Einrücken/Ausrücken: Buttons nur in der sortierbaren Ansicht (= sortable).
  // canIndent/canOutdent disablen den jeweiligen Button (spiegelt Backend-Regel).
  canIndent?: boolean;
  canOutdent?: boolean;
  onReindent?: (direction: "indent" | "outdent") => void;
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

  // useSortable wird immer aufgerufen (Hook-Regel), aber transform/listeners nur
  // angewandt, wenn props.sortable. In Smart-Views (sortable=false) bleibt die
  // Zeile dadurch exakt wie bisher.
  const sortable = useSortable({ id: props.task.id });
  const sortableStyle = props.sortable
    ? { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }
    : undefined;

  // Verschiebe-Ziele: alle Listen außer der aktuellen. Button nur zeigen, wenn
  // es überhaupt eine andere Liste gibt.
  const moveTargets = props.listNames.filter((n) => n !== props.task.listId);

  // recurrenceEditableInApp === false → nicht abhakbar, Badge "in Obsidian abhaken".
  const readOnlyRecurrence = props.task.recurrence !== null && !props.task.recurrenceEditableInApp;
  const mark = PRIORITY_MARK[props.task.priority];
  const hasDescription = props.task.description !== null && props.task.description.trim() !== "";

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
      ref={props.sortable ? sortable.setNodeRef : undefined}
      role="listitem"
      aria-selected={props.selected}
      onClick={props.onSelect}
      style={{ paddingLeft: `${props.task.depth * 1.5 + 0.75}rem`, ...sortableStyle }}
      className={cn(
        "flex items-center gap-2 border-b border-border py-1.5 pr-3 text-sm",
        props.selected && "bg-muted",
        props.sortable && sortable.isDragging && "opacity-50",
      )}
    >
      {props.selectMode ? (
        <input
          type="checkbox"
          checked={props.selectedForBulk ?? false}
          aria-label="Auswählen"
          onChange={() => props.onSelectBulk?.()}
          onClick={(e) => e.stopPropagation()}
          className="mr-1 shrink-0"
        />
      ) : null}

      {props.sortable ? (
        <button
          ref={sortable.setActivatorNodeRef}
          type="button"
          aria-label="Aufgabe umsortieren"
          // attributes/listeners NUR am Handle — sonst kollidiert der Drag mit
          // Checkbox, Inline-Edit und Verschiebe-Button der Zeile.
          {...sortable.attributes}
          {...sortable.listeners}
          onClick={(e) => e.stopPropagation()}
          className="flex shrink-0 cursor-grab touch-none items-center text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : null}

      {props.sortable ? (
        <>
          <button
            type="button"
            aria-label="Einrücken"
            disabled={!props.canIndent}
            onClick={(e) => {
              e.stopPropagation();
              props.onReindent?.("indent");
            }}
            className="flex shrink-0 items-center rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
          >
            <ListIndentIncrease className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Ausrücken"
            disabled={!props.canOutdent}
            onClick={(e) => {
              e.stopPropagation();
              props.onReindent?.("outdent");
            }}
            className="flex shrink-0 items-center rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
          >
            <ListIndentDecrease className="h-4 w-4" />
          </button>
        </>
      ) : null}

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
        // Titel + Notiz-Vorschau vertikal gruppiert, damit die Beschreibung
        // schon in der Zeile sichtbar ist (vorher nur im Detail-Modal).
        <div className="flex min-w-0 flex-1 flex-col">
          <button
            type="button"
            onDoubleClick={startEdit}
            className={cn(
              "truncate text-left",
              props.task.done && "text-muted-foreground line-through",
            )}
          >
            {mark ? <span className="mr-1">{mark}</span> : null}
            {props.task.title}
          </button>
          {hasDescription ? (
            <button
              type="button"
              aria-label="Notiz öffnen"
              onClick={(e) => {
                e.stopPropagation();
                props.onOpenDetail();
              }}
              className="flex min-w-0 items-start gap-1 text-left text-xs text-muted-foreground hover:text-foreground"
            >
              <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
              {/* line-clamp-3 + whitespace-pre-line: echte "\n" als Umbrüche, bis
                  zu 3 Zeilen mit automatischem "…" bei Überlauf. */}
              <span className="line-clamp-3 min-w-0 whitespace-pre-line">
                {props.task.description}
              </span>
            </button>
          ) : null}
        </div>
      )}

      <button
        type="button"
        aria-label="Details öffnen"
        onClick={(e) => {
          e.stopPropagation();
          props.onOpenDetail();
        }}
        className="flex shrink-0 items-center rounded p-1 text-muted-foreground hover:bg-muted"
      >
        <PanelRight className="h-4 w-4" />
      </button>

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
