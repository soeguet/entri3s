import { useState } from "react";
import { Check, ChevronDown, ChevronRight, FolderTree } from "lucide-react";
import type { FilterTreeNode } from "../../lib/filterTree";
import { cn } from "../../lib/utils";

interface EntryFilterTreeProps {
  nodes: FilterTreeNode[];
  // Menge ausgewählter Knoten-Pfade. Ein Knoten gilt als gewählt, wenn sein
  // Pfad oder der eines Vorfahren enthalten ist (Auswahl kaskadiert nach unten).
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

/** Multi-Select Hierarchie-Filter (Gruppe/Projekt/Ticket) mit Checkboxen. */
export function EntryFilterTree(props: EntryFilterTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleCollapse(path: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function isChecked(path: string): boolean {
    if (props.selected.has(path)) return true;
    // Vorfahre gewählt? Pfade sind hierarchisch (group/proj bzw. proj#ticket).
    for (const sel of props.selected) {
      if (path === sel || path.startsWith(`${sel}/`) || path.startsWith(`${sel}#`)) return true;
    }
    return false;
  }

  function toggle(node: FilterTreeNode) {
    const next = new Set(props.selected);
    if (next.has(node.path)) {
      next.delete(node.path);
    } else {
      // Redundante Nachfahren raus, dann den Knoten rein.
      const redundant = [...props.selected].filter(
        (sel) => sel.startsWith(`${node.path}/`) || sel.startsWith(`${node.path}#`),
      );
      for (const sel of redundant) next.delete(sel);
      next.add(node.path);
    }
    props.onChange(next);
  }

  function renderNode(node: FilterTreeNode, depth: number) {
    const hasChildren = node.children.length > 0;
    const isOpen = !collapsed.has(node.path);
    const checked = isChecked(node.path);
    return (
      <div key={node.path}>
        <div
          className="flex items-center gap-1 rounded px-1 py-1 text-sm text-foreground hover:bg-muted"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleCollapse(node.path)}
              className="shrink-0 rounded p-0.5 hover:bg-black/10"
              aria-label={isOpen ? "Einklappen" : "Ausklappen"}
            >
              {isOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <span className="w-[18px] shrink-0" />
          )}
          <button
            type="button"
            onClick={() => toggle(node)}
            aria-pressed={checked}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
              )}
            >
              {checked ? <Check className="h-3 w-3" /> : null}
            </span>
            <span className={cn("truncate", node.projectId !== null ? "font-medium" : "")}>
              {node.label}
            </span>
          </button>
        </div>
        {hasChildren && isOpen ? node.children.map((c) => renderNode(c, depth + 1)) : null}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => props.onChange(new Set())}
        className={cn(
          "flex w-full items-center gap-2 rounded px-2 py-1 text-sm font-medium",
          props.selected.size === 0
            ? "bg-primary text-primary-foreground"
            : "text-foreground hover:bg-muted",
        )}
      >
        <FolderTree className="h-4 w-4 shrink-0" />
        Alle (Filter zurücksetzen)
      </button>
      {props.nodes.map((n) => renderNode(n, 0))}
    </div>
  );
}
