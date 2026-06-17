import { useState } from "react";
import { ChevronDown, ChevronRight, FolderTree } from "lucide-react";
import type { ProjectTreeNode } from "../../lib/projectTree";
import { cn } from "../../lib/utils";

interface TicketTreeProps {
  nodes: ProjectTreeNode[];
  selectedPath: string | null; // null = „Alle Projekte"
  onSelect: (path: string | null) => void;
}

/** Sidebar-Baum zum Filtern nach Gruppe/Projekt. Aus den fullPaths abgeleitet. */
export function TicketTree(props: TicketTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggle(path: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function renderNode(node: ProjectTreeNode, depth: number) {
    const isGroup = node.projectId === null;
    const isOpen = !collapsed.has(node.path);
    const active = props.selectedPath === node.path;
    return (
      <div key={node.path}>
        <div
          className={cn(
            "flex items-center gap-1 rounded px-1 py-1 text-sm",
            active ? "bg-slate-900 text-slate-50" : "text-slate-700 hover:bg-slate-100",
          )}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {isGroup ? (
            <button
              type="button"
              onClick={() => toggle(node.path)}
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
            onClick={() => props.onSelect(node.path)}
            className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
          >
            <span className={cn("truncate", isGroup ? "font-medium" : "")}>{node.label}</span>
            <span className={cn("shrink-0 text-xs", active ? "text-slate-300" : "text-slate-400")}>
              {node.ticketCount}
            </span>
          </button>
        </div>
        {isGroup && isOpen ? node.children.map((c) => renderNode(c, depth + 1)) : null}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => props.onSelect(null)}
        className={cn(
          "flex w-full items-center gap-2 rounded px-2 py-1 text-sm font-medium",
          props.selectedPath === null
            ? "bg-slate-900 text-slate-50"
            : "text-slate-700 hover:bg-slate-100",
        )}
      >
        <FolderTree className="h-4 w-4 shrink-0" />
        Alle Projekte
      </button>
      {props.nodes.map((n) => renderNode(n, 0))}
    </div>
  );
}
