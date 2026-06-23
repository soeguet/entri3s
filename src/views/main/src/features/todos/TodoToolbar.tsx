import { useRef, useState } from "react";
import type { TodoPriority } from "../../../../../shared/types";
import { Popover } from "../../components/ui/popover";
import { Button, buttonVariants } from "../../components/ui/button";
import { Select } from "../../components/ui/select";
import { cn } from "../../lib/utils";
import type { TodoFilter, TodoSort } from "./taskFilterSort";

interface TodoToolbarProps {
  filter: TodoFilter;
  sort: TodoSort;
  // Verfügbare Tags der aktuellen Ansicht (für die Tag-Checkboxen).
  availableTags: string[];
  onSort: (sort: TodoSort) => void;
  onToggleTag: (tag: string) => void;
  onTogglePriority: (priority: TodoPriority) => void;
  onSetStatus: (status: TodoFilter["status"]) => void;
  onReset: () => void;
  // true wenn Filter/Sort aktiv ist → "Zurücksetzen" anzeigen.
  active: boolean;
}

// Emoji-Labels wie in TodoQuickAdd/TodoRow, hier als geordnete Liste highest..lowest
// für die Prioritäts-Checkboxen.
const PRIORITIES: Array<{ value: TodoPriority; label: string }> = [
  { value: "highest", label: "🔺 Höchste" },
  { value: "high", label: "⏫ Hoch" },
  { value: "medium", label: "🔼 Mittel" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "🔽 Niedrig" },
  { value: "lowest", label: "⏬ Niedrigste" },
];

// Kompakte Filter-/Sortier-Leiste über der Todo-Liste.
export function TodoToolbar(props: TodoToolbarProps) {
  const [openPopover, setOpenPopover] = useState<"tags" | "priority" | null>(null);
  const tagBtn = useRef<HTMLButtonElement>(null);
  const prioBtn = useRef<HTMLButtonElement>(null);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Select
        aria-label="Sortierung"
        className="w-auto"
        value={props.sort}
        onChange={(e) => props.onSort(e.target.value as TodoSort)}
      >
        <option value="manual">Manuell</option>
        <option value="priority">Priorität</option>
        <option value="due">Fällig</option>
        <option value="alpha">Alphabetisch</option>
      </Select>

      {/* Raw <button> statt <Button>, weil wir einen ref als Popover-Anker
          brauchen (Button reicht keinen ref durch) — Pattern wie in TodoRow. */}
      <button
        ref={tagBtn}
        type="button"
        className={cn(
          buttonVariants({
            variant: props.filter.tags.length > 0 ? "default" : "outline",
            size: "sm",
          }),
        )}
        onClick={() => setOpenPopover((p) => (p === "tags" ? null : "tags"))}
      >
        Tags{props.filter.tags.length > 0 ? ` (${props.filter.tags.length})` : ""}
      </button>
      <Popover
        open={openPopover === "tags"}
        anchor={tagBtn.current}
        onClose={() => setOpenPopover(null)}
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Nach Tags filtern
        </p>
        {props.availableTags.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Tags vorhanden.</p>
        ) : (
          <div className="flex max-h-60 flex-col gap-1 overflow-auto">
            {props.availableTags.map((tag) => (
              <label key={tag} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={props.filter.tags.includes(tag)}
                  onChange={() => props.onToggleTag(tag)}
                />
                {tag}
              </label>
            ))}
          </div>
        )}
      </Popover>

      <button
        ref={prioBtn}
        type="button"
        className={cn(
          buttonVariants({
            variant: props.filter.priorities.length > 0 ? "default" : "outline",
            size: "sm",
          }),
        )}
        onClick={() => setOpenPopover((p) => (p === "priority" ? null : "priority"))}
      >
        Priorität
        {props.filter.priorities.length > 0 ? ` (${props.filter.priorities.length})` : ""}
      </button>
      <Popover
        open={openPopover === "priority"}
        anchor={prioBtn.current}
        onClose={() => setOpenPopover(null)}
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Nach Priorität filtern
        </p>
        <div className="flex flex-col gap-1">
          {PRIORITIES.map((item) => (
            <label key={item.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={props.filter.priorities.includes(item.value)}
                onChange={() => props.onTogglePriority(item.value)}
              />
              {item.label}
            </label>
          ))}
        </div>
      </Popover>

      <Select
        aria-label="Status"
        className="w-auto"
        value={props.filter.status}
        onChange={(e) => props.onSetStatus(e.target.value as TodoFilter["status"])}
      >
        <option value="open">Offen</option>
        <option value="done">Erledigt</option>
        <option value="all">Alle</option>
      </Select>

      {props.active ? (
        <Button type="button" variant="ghost" size="sm" onClick={props.onReset}>
          Zurücksetzen
        </Button>
      ) : null}
    </div>
  );
}
