import { forwardRef, useState } from "react";
import type { TodoPriority, TodoTaskCreate } from "../../../../../shared/types";
import { Select } from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { todoErrorMessage } from "./todoError";
import { parseQuickAdd } from "./parseQuickAdd";
import { resolveTargetList } from "./quickAddList";

interface QuickAddList {
  id: string;
  name: string;
  sections: string[];
}

interface TodoQuickAddProps {
  // Alle existierenden Listen (id = Dateiname, sections je Liste). Bewusster
  // API-Bruch ggü. der alten isolierten `sections`-Prop: das `&Liste`-Feature
  // muss die Sektionen der RESOLVED Ziel-Liste zeigen, nicht die einer fremden.
  lists: QuickAddList[];
  // Fallback-Ziel (gewählte/erste Liste); null wenn keine Liste wählbar ist.
  listId: string | null;
  // Heutiges Datum (yyyy-MM-dd, Berlin) als Anker fürs Natural-Language-Parsing.
  today: string;
  // hadExplicitList: true wenn pickedListId gesetzt ODER listQuery eine Liste traf.
  onAdd: (input: TodoTaskCreate, hadExplicitList: boolean) => void;
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

// Quick-Add-Zeile mit Natural-Language-Eingabe: Priorität (p1..p4), #tags,
// Fälligkeit (@heute/@morgen…) UND Ziel-Liste (&Liste) werden aus dem Text
// geparst. `&Liste` öffnet ein NICHT-modales Dropdown (kein Popover/Focus-Trap:
// das würde isModalOpen() triggern und alle Page-Hotkeys + den Input-Fokus
// blockieren). Der getippte Token ist nur Filter-Query; pickedListId (Auswahl)
// ist autoritativ (Listennamen können Leerzeichen enthalten).
export const TodoQuickAdd = forwardRef<HTMLInputElement, TodoQuickAddProps>(
  function TodoQuickAdd(props, ref) {
    const [title, setTitle] = useState("");
    const [section, setSection] = useState("");
    const [pickedListId, setPickedListId] = useState<string | null>(null);
    const [activeIdx, setActiveIdx] = useState(0);
    // Esc schließt NUR das Dropdown (ohne Auswahl): eigener Flag statt
    // pickedListId-Missbrauch, damit der Token im Titel bleibt und der Submit
    // sauber auf den Fallback fällt.
    const [dismissed, setDismissed] = useState(false);

    const parsed = parseQuickAdd(title, props.today);

    const resolvedListId = resolveTargetList(
      pickedListId,
      parsed.listQuery,
      props.lists,
      props.listId,
    );
    const resolvedList = props.lists.find((l) => l.id === resolvedListId) ?? null;
    const sections = resolvedList?.sections ?? [];
    // Section gegen die RESOLVED Liste revalidieren: eine in Liste A gewählte
    // Sektion darf nicht in Liste B angelegt werden (sonst stiller Strukturmüll
    // via insertUnderSection). Ungültige Section → effektiv keine.
    const sectionValid = section !== "" && sections.includes(section);
    const effectiveSection = sectionValid ? section : "";

    // hadExplicitList: pickedListId ODER ein listQuery, das eine echte Liste traf.
    const queryMatched =
      parsed.listQuery !== null &&
      props.lists.some((l) => l.id.toLowerCase() === parsed.listQuery!.toLowerCase());
    const hadExplicitList = pickedListId !== null || queryMatched;

    // Dropdown öffnet, sobald ein unaufgelöster `&`-Token existiert (kein
    // Caret-Tracking). Unaufgelöst = noch keine Auswahl getroffen.
    const dropdownOpen = parsed.listQuery !== null && pickedListId === null && !dismissed;
    const matches = dropdownOpen
      ? props.lists.filter((l) => l.id.toLowerCase().includes(parsed.listQuery!.toLowerCase()))
      : [];
    const clampedIdx = matches.length === 0 ? 0 : Math.min(activeIdx, matches.length - 1);

    function pick(list: QuickAddList) {
      setPickedListId(list.id);
      // Token-Text durch den exakten Namen ersetzen (letztes `&…`-Token).
      setTitle((t) => t.replace(/(^|\s)&\S+/, (_m, pre: string) => `${pre}&${list.name}`));
      setActiveIdx(0);
    }

    function submit() {
      if (title.trim() === "" || resolvedListId === null) return;
      const input: TodoTaskCreate = { listId: resolvedListId, title: parsed.title };
      if (parsed.priority !== "normal") input.priority = parsed.priority;
      if (parsed.due !== null) input.due = parsed.due;
      if (parsed.tags.length > 0) input.tags = parsed.tags;
      if (effectiveSection !== "") input.section = effectiveSection;
      props.onAdd(input, hadExplicitList);
      // Bei Erfolg leert der Aufrufer via key-Remount; bei Konflikt NICHT leeren.
    }

    function onKeyDown(e: React.KeyboardEvent) {
      if (dropdownOpen && matches.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActiveIdx((i) => Math.min(matches.length - 1, i + 1));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setActiveIdx((i) => Math.max(0, i - 1));
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          pick(matches[clampedIdx]);
          return;
        }
        // Esc schließt NUR das Dropdown (nicht submitten/App): durch Setzen von
        // pickedListId auf den getippten Token "auflösen" geht nicht (Token ≠ id);
        // stattdessen merken wir uns, dass das Dropdown geschlossen ist.
        if (e.key === "Escape") {
          e.preventDefault();
          setDismissed(true); // nur Dropdown zu; Token bleibt, App/Submit unberührt
          return;
        }
      }
      if (e.key === "Enter") submit();
    }

    // Chip "→ <Liste>" nur wenn Ziel ≠ Default-Fallback.
    const targetDiffers = resolvedListId !== null && resolvedListId !== props.listId;
    const hasChips =
      parsed.due !== null ||
      parsed.priority !== "normal" ||
      parsed.tags.length > 0 ||
      targetDiffers;

    return (
      <div className="relative mb-3 space-y-1">
        <div className="flex items-center gap-2">
          {/* Natives input statt <Input>: Input forwardet keinen ref, der
              Hotkey "n" muss aber fokussieren können. */}
          <input
            ref={ref}
            value={title}
            aria-label="Neue Aufgabe"
            placeholder="Neue Aufgabe… (z.B. 'Angebot @morgen #arbeit p1 &Arbeit')"
            disabled={props.listId === null}
            onChange={(e) => {
              setTitle(e.target.value);
              // Tippen am Token erneut → frühere Auswahl/Esc verwerfen, Dropdown lebt.
              setPickedListId(null);
              setDismissed(false);
            }}
            onKeyDown={onKeyDown}
            className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
          {sections.length > 0 ? (
            <Select
              aria-label="Sektion"
              value={effectiveSection}
              onChange={(e) => setSection(e.target.value)}
              className="w-32"
            >
              <option value="">Keine Sektion</option>
              {sections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          ) : null}
          <Button onClick={submit} disabled={resolvedListId === null}>
            Hinzufügen
          </Button>
        </div>

        {dropdownOpen && matches.length > 0 ? (
          // Leichtgewichtiges, absolut positioniertes, NICHT-modales Dropdown:
          // reine Button-Liste, KEIN eigenes Input, KEIN autoFocus, KEIN
          // aria-modal — sonst würde isModalOpen() Page-Hotkeys lahmlegen.
          <ul
            aria-label="Listen-Vorschläge"
            className="absolute left-0 top-10 z-40 max-h-60 w-64 overflow-auto rounded-md border border-border bg-card py-1 shadow-lg"
          >
            {matches.map((l, i) => (
              <li key={l.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === clampedIdx}
                  onMouseDown={(e) => {
                    // mousedown statt click: nicht erst den Input blur'en.
                    e.preventDefault();
                    pick(l);
                  }}
                  className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-muted ${
                    i === clampedIdx ? "bg-muted" : ""
                  }`}
                >
                  {l.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {hasChips ? (
          <div className="flex flex-wrap items-center gap-1" aria-label="Erkannt">
            {targetDiffers ? (
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                → {resolvedList?.name ?? resolvedListId}
              </span>
            ) : null}
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
