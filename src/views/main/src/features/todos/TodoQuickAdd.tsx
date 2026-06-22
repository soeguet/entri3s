import { forwardRef, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import type { TodoPriority, TodoTaskCreate } from "../../../../../shared/types";
import { Select } from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { TodoDatePicker } from "./TodoDatePicker";
import { todoErrorMessage } from "./todoError";

interface TodoQuickAddProps {
  // Ziel-Liste; null wenn (noch) keine Liste wählbar ist (z.B. leerer Vault).
  listId: string | null;
  // Sektionen der Ziel-Liste (sichtbarer Selektor, optional).
  sections: string[];
  onAdd: (input: TodoTaskCreate) => void;
  error: unknown;
}

const PRIORITIES: Array<{ value: TodoPriority; label: string }> = [
  { value: "highest", label: "🔺 Höchste" },
  { value: "high", label: "⏫ Hoch" },
  { value: "medium", label: "🔼 Mittel" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "🔽 Niedrig" },
  { value: "lowest", label: "⏬ Niedrigste" },
];

// Quick-Add-Zeile mit sichtbarem Priority-/Due-/Section-Selektor. Bei Konflikt
// oder Fehler bleibt die getippte Eingabe erhalten (kein Reset im Fehlerfall).
export const TodoQuickAdd = forwardRef<HTMLInputElement, TodoQuickAddProps>(
  function TodoQuickAdd(props, ref) {
    const [title, setTitle] = useState("");
    const [priority, setPriority] = useState<TodoPriority>("normal");
    const [due, setDue] = useState<string | null>(null);
    const [section, setSection] = useState("");
    const [pickerOpen, setPickerOpen] = useState(false);
    const dateBtnRef = useRef<HTMLButtonElement>(null);

    function submit() {
      const trimmed = title.trim();
      if (trimmed === "" || props.listId === null) return;
      const input: TodoTaskCreate = { listId: props.listId, title: trimmed, priority };
      if (due !== null) input.due = due;
      if (section !== "") input.section = section;
      props.onAdd(input);
      // Erfolg/Fehler kennt diese Zeile nicht direkt; der Aufrufer leert das Feld
      // über key-Remount nach erfolgreichem Add. Hier optimistisch leeren wäre
      // bei Konflikt Datenverlust → daher NICHT.
    }

    return (
      <div className="mb-3 space-y-1">
        <div className="flex items-center gap-2">
          {/* Natives input statt <Input>: Input forwardet keinen ref, der
              Hotkey "n" muss aber fokussieren können. */}
          <input
            ref={ref}
            value={title}
            aria-label="Neue Aufgabe"
            placeholder="Neue Aufgabe…"
            disabled={props.listId === null}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
          <Select
            aria-label="Priorität"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TodoPriority)}
            className="w-32"
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
          {props.sections.length > 0 ? (
            <Select
              aria-label="Sektion"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-32"
            >
              <option value="">Keine Sektion</option>
              {props.sections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          ) : null}
          {/* Natives button als Popover-Anker (Button forwardet keinen ref). */}
          <button
            ref={dateBtnRef}
            type="button"
            aria-label="Fälligkeit"
            onClick={() => setPickerOpen(true)}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-input bg-card px-3 text-xs font-medium hover:bg-muted"
          >
            <Calendar className="h-4 w-4" />
            {due ?? "Datum"}
          </button>
          <Button onClick={submit} disabled={props.listId === null}>
            Hinzufügen
          </Button>
        </div>

        <TodoDatePicker
          open={pickerOpen}
          anchor={dateBtnRef.current}
          due={due}
          onClose={() => setPickerOpen(false)}
          onPick={(d) => {
            setDue(d);
            setPickerOpen(false);
          }}
        />

        {props.error ? (
          <p className="text-xs text-danger-accent">{todoErrorMessage(props.error)}</p>
        ) : null}
      </div>
    );
  },
);
