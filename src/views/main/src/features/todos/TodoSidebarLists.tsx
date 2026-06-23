import { useState } from "react";
import { ChevronDown, ChevronRight, List, Plus } from "lucide-react";
import type { TodoList } from "../../../../../shared/types";
import { cn } from "../../lib/utils";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { LIST_DELIMITER, childLabel, groupLists } from "./listHierarchy";

interface TodoSidebarListsProps {
  lists: TodoList[];
  // null = Smart-View-Modus; sonst die aktive Liste (volle id).
  selectedList: string | null;
  onList: (listId: string) => void;
  onCreateList: (name: string) => void;
}

function openCount(list: TodoList): number {
  return list.tasks.filter((t) => !t.done).length;
}

// Rendert die Listen gruppiert nach Parent-Segment (genau eine Hierarchie-Ebene).
// Wert für Selektion/Anlegen bleibt immer die volle Liste-id bzw. der volle Name;
// nur das Label wird über die Helper aufbereitet.
export function TodoSidebarLists(props: TodoSidebarListsProps) {
  // Eingeklappte Gruppen (per parentName), nicht persistiert, Default aufgeklappt.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // parentName, dessen Inline-Child-Input gerade offen ist (max. eines).
  const [adding, setAdding] = useState<string | null>(null);
  const [childName, setChildName] = useState("");

  const groups = groupLists(props.lists);

  function toggleCollapse(parentName: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(parentName)) next.delete(parentName);
      else next.add(parentName);
      return next;
    });
  }

  function openAdd(parentName: string) {
    setAdding(parentName);
    setChildName("");
  }

  function submitChild(parentName: string) {
    const name = childName.trim();
    if (name === "") return;
    props.onCreateList(parentName + LIST_DELIMITER + name);
    setAdding(null);
    setChildName("");
  }

  return (
    <div className="space-y-1">
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.parentName);
        const hasChildren = group.children.length > 0;
        const selectable = group.parent !== null;

        return (
          <div key={group.parentName} className="group/list">
            <div
              role={selectable ? "button" : undefined}
              tabIndex={selectable ? 0 : undefined}
              // Explizites Label, damit der Accessible Name des Headers exakt der
              // Listenname ist und nicht die Labels der inneren Buttons mitzieht.
              aria-label={selectable ? childLabel(group.parent!.name) : undefined}
              onClick={selectable ? () => props.onList(group.parent!.id) : undefined}
              onKeyDown={
                selectable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") props.onList(group.parent!.id);
                    }
                  : undefined
              }
              className={cn(
                "flex w-full items-center gap-1 rounded-md px-2 py-2 text-sm",
                selectable && "cursor-pointer",
                selectable && props.selectedList === group.parent!.id
                  ? "bg-primary text-primary-foreground"
                  : selectable
                    ? "text-muted-foreground hover:bg-muted"
                    : "text-muted-foreground/70",
              )}
            >
              {hasChildren ? (
                <button
                  type="button"
                  aria-label={isCollapsed ? "Gruppe aufklappen" : "Gruppe einklappen"}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCollapse(group.parentName);
                  }}
                  className="shrink-0 rounded p-0.5 hover:text-foreground"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              ) : (
                <span className="w-4 shrink-0" />
              )}
              <List className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left">
                {group.parent === null ? group.parentName : childLabel(group.parent.name)}
              </span>
              <button
                type="button"
                aria-label={`Unterliste in ${group.parentName} anlegen`}
                onClick={(e) => {
                  e.stopPropagation();
                  openAdd(group.parentName);
                }}
                className="shrink-0 rounded p-0.5 opacity-0 hover:text-foreground group-hover/list:opacity-100"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              {selectable ? (
                <span className="shrink-0 text-xs">{openCount(group.parent!)}</span>
              ) : null}
            </div>

            {adding === group.parentName ? (
              <div className="flex gap-1 py-1 pl-6 pr-2">
                <Input
                  autoFocus
                  value={childName}
                  aria-label={`Unterliste in ${group.parentName}`}
                  placeholder="Unterliste"
                  onChange={(e) => setChildName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitChild(group.parentName);
                    if (e.key === "Escape") setAdding(null);
                  }}
                />
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Unterliste anlegen"
                  onClick={() => submitChild(group.parentName)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : null}

            {hasChildren && !isCollapsed
              ? group.children.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => props.onList(child.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md py-2 pl-6 pr-2 text-sm",
                      props.selectedList === child.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <List className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-left">
                      {childLabel(child.id)}
                    </span>
                    <span className="shrink-0 text-xs">{openCount(child)}</span>
                  </button>
                ))
              : null}
          </div>
        );
      })}
    </div>
  );
}
