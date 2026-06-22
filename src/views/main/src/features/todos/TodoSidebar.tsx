import { useState } from "react";
import { CalendarClock, CalendarDays, Inbox, ListChecks, Plus } from "lucide-react";
import type { TodoList } from "../../../../../shared/types";
import { cn } from "../../lib/utils";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { todoErrorMessage } from "./todoError";
import type { SmartView } from "./smartViewFilter";

interface TodoSidebarProps {
  lists: TodoList[];
  counts: Record<SmartView, number>;
  view: SmartView;
  // null = alle Listen (Smart-View-Modus); sonst eine konkrete Liste.
  selectedList: string | null;
  onView: (view: SmartView) => void;
  onList: (listId: string) => void;
  onCreateList: (name: string) => void;
  // Fehler der letzten createList-Mutation (z.B. INVALID_NAME), inline gezeigt.
  createError: unknown;
}

const SMART: Array<{ view: SmartView; label: string; icon: typeof Inbox }> = [
  { view: "today", label: "Heute", icon: CalendarDays },
  { view: "overdue", label: "Überfällig", icon: CalendarClock },
  { view: "upcoming", label: "Anstehend", icon: Inbox },
  { view: "all", label: "Alle", icon: ListChecks },
];

export function TodoSidebar(props: TodoSidebarProps) {
  const [newName, setNewName] = useState("");

  function submit() {
    const name = newName.trim();
    if (name === "") return;
    props.onCreateList(name);
    // Eingabe NICHT sofort leeren — bei INVALID_NAME bleibt sie erhalten. Der
    // Aufrufer leert sie über einen Reset, sobald die Liste angelegt wurde.
  }

  return (
    <aside className="w-56 shrink-0 space-y-4">
      <nav className="space-y-1">
        {SMART.map((item) => (
          <button
            key={item.view}
            type="button"
            onClick={() => props.onView(item.view)}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm",
              props.selectedList === null && props.view === item.view
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <span className="flex items-center gap-2">
              <item.icon className="h-4 w-4" />
              {item.label}
            </span>
            <span className="text-xs">{props.counts[item.view]}</span>
          </button>
        ))}
      </nav>

      <div>
        <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Listen
        </p>
        <div className="space-y-1">
          {props.lists.map((list) => (
            <button
              key={list.id}
              type="button"
              onClick={() => props.onList(list.id)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm",
                props.selectedList === list.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <span className="truncate">{list.name}</span>
              <span className="text-xs">{list.tasks.filter((t) => !t.done).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1 px-3">
        <div className="flex gap-1">
          <Input
            value={newName}
            aria-label="Neue Liste"
            placeholder="Neue Liste"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
          <Button size="icon" variant="outline" aria-label="Liste anlegen" onClick={submit}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {props.createError ? (
          <p className="text-xs text-danger-accent">{todoErrorMessage(props.createError)}</p>
        ) : null}
      </div>
    </aside>
  );
}
