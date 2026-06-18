import { ChevronLeft } from "lucide-react";
import type { Tag } from "../../../../../shared/types";
import { cn } from "../../lib/utils";

interface TagPickerProps {
  tags: Tag[]; // alle verfügbaren Tags
  value: number[]; // aktuell ausgewählte tagIds
  onToggle: (id: number) => void; // schaltet ein Tag an/aus (Parent persistiert)
  onDone: () => void; // schliesst den Dialog
}

/**
 * Tag-Auswahl im Modal: Mehrfachauswahl per Toggle-Chips (anders als der
 * TicketPicker, der ein einzelnes Ticket wählt und sofort zurückkehrt). Jeder
 * Klick schaltet ein Tag und bleibt offen; „Fertig" schliesst.
 */
export function TagPicker(props: TagPickerProps) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={props.onDone}
          className="rounded p-1 text-muted-foreground hover:bg-muted"
          aria-label="Zurück"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="text-base font-semibold">Tags wählen</h3>
      </div>

      {props.tags.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-muted-foreground">
          Keine Tags angelegt. Tags lassen sich unter „Verwaltung" erstellen.
        </p>
      ) : (
        <div className="flex max-h-[55vh] flex-wrap gap-2 overflow-y-auto py-1">
          {props.tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => props.onToggle(tag.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                props.value.includes(tag.id)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input text-muted-foreground hover:bg-muted",
              )}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={props.onDone}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Fertig
        </button>
      </div>
    </div>
  );
}
