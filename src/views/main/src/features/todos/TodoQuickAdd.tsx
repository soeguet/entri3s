import { forwardRef, useState } from "react";
import type { TodoPriority, TodoTaskCreate } from "../../../../../shared/types";
import { Select } from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { todoErrorMessage } from "./todoError";
import { parseQuickAdd } from "./parseQuickAdd";

interface TodoQuickAddProps {
  // Ziel-Liste; null wenn (noch) keine Liste wählbar ist (z.B. leerer Vault).
  listId: string | null;
  // Sektionen der Ziel-Liste (sichtbarer Selektor, optional).
  sections: string[];
  // Heutiges Datum (yyyy-MM-dd, Berlin) als Anker fürs Natural-Language-Parsing.
  today: string;
  onAdd: (input: TodoTaskCreate) => void;
  error: unknown;
}

const PRIORITY_LABEL: Record<TodoPriority, string> = {
  highest: "🔺 Höchste",
  high: "⏫ Hoch",
  medium: "🔼 Mittel",
  normal: "Normal",
  low: "🔽 Niedrig",
  lowest: "⏬ Niedrigste",
};

// Quick-Add-Zeile mit Natural-Language-Eingabe: Priorität (p1..p4), #tags und
// Fälligkeit (@heute/@morgen/@montag/@1.7. …) werden aus dem Titeltext geparst.
// Datums-Tokens nur noch mit "@"-Präfix, damit bloße Wörter (z.B. "so") nicht
// fälschlich als Datum gelten.
// Manuelle Priority-/Datum-Selektoren wurden bewusst durch das NL-Feld ersetzt;
// der Section-Selektor bleibt (Sektion ist nicht aus dem Freitext ableitbar).
// Bei Konflikt oder Fehler bleibt die getippte Eingabe erhalten (kein Reset).
export const TodoQuickAdd = forwardRef<HTMLInputElement, TodoQuickAddProps>(
  function TodoQuickAdd(props, ref) {
    const [title, setTitle] = useState("");
    const [section, setSection] = useState("");

    const parsed = parseQuickAdd(title, props.today);

    function submit() {
      if (title.trim() === "" || props.listId === null) return;
      const input: TodoTaskCreate = { listId: props.listId, title: parsed.title };
      if (parsed.priority !== "normal") input.priority = parsed.priority;
      if (parsed.due !== null) input.due = parsed.due;
      if (parsed.tags.length > 0) input.tags = parsed.tags;
      if (section !== "") input.section = section;
      props.onAdd(input);
      // Bei Erfolg leert der Aufrufer via key-Remount; bei Konflikt NICHT leeren
      // (Datenverlust vermeiden).
    }

    const hasChips = parsed.due !== null || parsed.priority !== "normal" || parsed.tags.length > 0;

    return (
      <div className="mb-3 space-y-1">
        <div className="flex items-center gap-2">
          {/* Natives input statt <Input>: Input forwardet keinen ref, der
              Hotkey "n" muss aber fokussieren können. */}
          <input
            ref={ref}
            value={title}
            aria-label="Neue Aufgabe"
            placeholder="Neue Aufgabe… (z.B. 'Angebot @morgen #arbeit p1')"
            disabled={props.listId === null}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
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
          <Button onClick={submit} disabled={props.listId === null}>
            Hinzufügen
          </Button>
        </div>

        {hasChips ? (
          <div className="flex flex-wrap items-center gap-1" aria-label="Erkannt">
            {parsed.due !== null ? (
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                📅 {parsed.due}
              </span>
            ) : null}
            {parsed.priority !== "normal" ? (
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {PRIORITY_LABEL[parsed.priority]}
              </span>
            ) : null}
            {parsed.tags.map((t) => (
              <span
                key={t}
                className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                #{t}
              </span>
            ))}
          </div>
        ) : null}

        {props.error ? (
          <p className="text-xs text-danger-accent">{todoErrorMessage(props.error)}</p>
        ) : null}
      </div>
    );
  },
);
