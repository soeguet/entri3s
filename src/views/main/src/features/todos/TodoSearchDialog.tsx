import { useMemo, useRef } from "react";
import type { TodoList, TodoTask } from "../../../../../shared/types";
import { cn } from "../../lib/utils";
import { Dialog } from "../../components/ui/dialog";
import { CommandList, type CommandListSection } from "../../components/CommandList";

interface TodoSearchDialogProps {
  open: boolean;
  onClose: () => void;
  lists: TodoList[];
  onPick: (task: TodoTask) => void;
}

// Priorität als kompaktes Emoji (gleiche Konvention wie TodoRow). "normal"
// zeigt kein Emoji.
const PRIORITY_MARK: Record<TodoTask["priority"], string | null> = {
  highest: "🔺",
  high: "⏫",
  medium: "🔼",
  normal: null,
  low: "🔽",
  lowest: "⏬",
};

// Cap auf insgesamt 300 Tasks über alle Listen, damit das DOM bei sehr vielen
// Aufgaben klein bleibt — die Suche filtert nur innerhalb dieser 300 (akzeptabel
// für eine Schnellsuche).
const MAX_TASKS = 300;

function buildSearchText(task: TodoTask): string {
  const parts: string[] = [task.title];
  for (const tag of task.tags) parts.push(`#${tag}`);
  if (task.section) parts.push(task.section);
  parts.push(task.listId);
  return parts.join(" ");
}

export function TodoSearchDialog(props: TodoSearchDialogProps) {
  const onPickRef = useRef(props.onPick);
  onPickRef.current = props.onPick;

  const sections: CommandListSection[] = useMemo(() => {
    if (!props.open) return [];

    let remaining = MAX_TASKS;
    const result: CommandListSection[] = [];

    for (const list of props.lists) {
      if (remaining <= 0) break;
      // Offene Tasks vor erledigten (done zuletzt), sonst stabile Reihenfolge.
      const sorted = [...list.tasks]
        .sort((a, b) => Number(a.done) - Number(b.done))
        .slice(0, remaining);
      remaining -= sorted.length;
      if (sorted.length === 0) continue;

      result.push({
        label: list.name,
        items: sorted.map((task) => {
          const mark = PRIORITY_MARK[task.priority];
          return {
            id: `${task.listId}#${task.id}`,
            searchText: buildSearchText(task),
            content: (
              <div className="flex w-full items-center gap-2 text-sm">
                {mark ? <span className="shrink-0">{mark}</span> : null}
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate",
                    task.done && "text-muted-foreground line-through",
                  )}
                >
                  {task.title}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{list.name}</span>
                {task.due ? (
                  <span className="shrink-0 text-xs text-muted-foreground">{task.due}</span>
                ) : null}
              </div>
            ),
            onSelect: () => onPickRef.current(task),
          };
        }),
      });
    }

    return result;
  }, [props.open, props.lists]);

  return (
    <Dialog open={props.open} onClose={props.onClose} title="Aufgabe suchen" size="lg">
      <CommandList
        placeholder="Aufgabe, #tag oder Liste suchen…"
        sections={sections}
        emptyText="Keine Aufgaben gefunden."
        onClose={props.onClose}
      />
    </Dialog>
  );
}
