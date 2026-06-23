import { useRef, useState } from "react";
import { Calendar, Check, FolderInput, Trash2, X } from "lucide-react";
import { Button, buttonVariants } from "../../components/ui/button";
import { TodoDatePicker } from "./TodoDatePicker";
import { TodoMoveMenu } from "./TodoMoveMenu";

interface TodoBulkBarProps {
  count: number;
  // ALLE Listennamen — Verschiebe-Ziele.
  listNames: string[];
  // Aktuell gewählte Liste (Smart-View → null). Bei null (gemischte Auswahl) wird
  // keine Quell-Liste ausgeschlossen, es werden alle Listen als Ziel angeboten.
  currentList: string | null;
  onComplete: () => void;
  onReschedule: (due: string | null) => void;
  onMove: (toList: string) => void;
  onDelete: () => void;
  onClear: () => void;
}

// Aktionsleiste für die Mehrfachauswahl. Reine UI — die Mutationen triggert der
// Aufrufer (TodosPage) in den Handlern.
export function TodoBulkBar(props: TodoBulkBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const dateBtnRef = useRef<HTMLButtonElement>(null);
  const moveBtnRef = useRef<HTMLButtonElement>(null);

  // currentList === null → gemischte Auswahl, alle Listen anbieten.
  const moveTargets =
    props.currentList === null
      ? props.listNames
      : props.listNames.filter((n) => n !== props.currentList);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm">
      <span className="font-medium">{props.count} ausgewählt</span>

      <Button variant="outline" size="sm" onClick={props.onComplete}>
        <Check className="h-3 w-3" />
        Abhaken
      </Button>

      <button
        ref={dateBtnRef}
        type="button"
        className={buttonVariants({ variant: "outline", size: "sm" })}
        onClick={() => setPickerOpen(true)}
      >
        <Calendar className="h-3 w-3" />
        Datum…
      </button>
      <TodoDatePicker
        open={pickerOpen}
        anchor={dateBtnRef.current}
        due={null}
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
          className={buttonVariants({ variant: "outline", size: "sm" })}
          onClick={() => setMoveOpen(true)}
        >
          <FolderInput className="h-3 w-3" />
          Verschieben…
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

      <Button variant="destructive" size="sm" onClick={props.onDelete}>
        <Trash2 className="h-3 w-3" />
        Löschen
      </Button>

      <Button variant="ghost" size="sm" className="ml-auto" onClick={props.onClear}>
        <X className="h-3 w-3" />
        Fertig
      </Button>
    </div>
  );
}
