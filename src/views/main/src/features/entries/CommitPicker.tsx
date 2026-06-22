import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Search, GitCommitHorizontal } from "lucide-react";
import type { Commit, Project } from "../../../../../shared/types";
import { cn } from "../../lib/utils";
import { keys } from "../../lib/queryKeys";
import { getCommitsForDate } from "../../api";
import { unwrap } from "../../lib/errors";
import { Button } from "../../components/ui/button";
import { SectionHeader } from "../../components/SectionHeader";

interface CommitPickerProps {
  date: string; // YYYY-MM-DD for the query
  projects: Project[]; // for project labels
  onApply: (messages: string[]) => void; // selected commit messages
  onCancel: () => void; // back without changes
}

function groupByProject(
  commits: Commit[],
  byId: Map<number, Project>,
): Array<{ label: string; commits: Commit[] }> {
  const map = new Map<number, Commit[]>();
  for (const c of commits) {
    const list = map.get(c.projectId) ?? [];
    list.push(c);
    map.set(c.projectId, list);
  }
  return [...map.entries()]
    .map(([pid, cs]) => ({
      label: byId.get(pid)?.fullPath ?? `Projekt ${pid}`,
      commits: cs,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export function CommitPicker(props: CommitPickerProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const commits = useQuery({
    queryKey: keys.commits(props.date),
    queryFn: async () => unwrap(await getCommitsForDate(props.date)),
    staleTime: 5 * 60_000,
  });

  const byId = new Map(props.projects.map((p) => [p.id, p]));

  const q = query.trim().toLowerCase();
  const filtered = q
    ? (commits.data ?? []).filter((c) => {
        const projectName = byId.get(c.projectId)?.name ?? "";
        const hay = `${c.shortHash} ${c.title} ${projectName}`.toLowerCase();
        return q.split(/\s+/).every((term) => hay.includes(term));
      })
    : (commits.data ?? []);

  const groups = groupByProject(filtered, byId);

  function toggleCommit(hash: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return next;
    });
  }

  function handleApply() {
    const allCommits = commits.data ?? [];
    const messages = allCommits.filter((c) => selected.has(c.hash)).map((c) => c.title);
    props.onApply(messages);
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={props.onCancel}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label="Zurück"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h3 className="text-base font-semibold">Commits</h3>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 ? (
            <span className="text-xs text-muted-foreground">{selected.size} ausgewählt</span>
          ) : null}
          <Button type="button" disabled={selected.size === 0} onClick={handleApply}>
            Übernehmen
          </Button>
        </div>
      </div>

      {/* Search field */}
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suchen: Hash, Titel oder Projekt…"
          className="h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* List */}
      <div className="max-h-[55vh] overflow-y-auto">
        {commits.isLoading ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Commits werden geladen…
          </p>
        ) : commits.isError ? (
          <div className="px-3 py-6 text-center">
            <p className="text-sm text-danger-accent">Fehler beim Laden der Commits</p>
            <Button
              type="button"
              variant="outline"
              className="mt-2"
              onClick={() => commits.refetch()}
            >
              Erneut versuchen
            </Button>
          </div>
        ) : groups.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Keine Commits für diesen Tag gefunden.
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.label}>
              <SectionHeader>{g.label}</SectionHeader>
              {g.commits.map((c) => (
                <button
                  key={c.hash}
                  type="button"
                  onClick={() => toggleCommit(c.hash)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm",
                    selected.has(c.hash) ? "bg-muted" : "hover:bg-muted",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.hash)}
                    readOnly
                    className="h-3.5 w-3.5 shrink-0 accent-primary"
                  />
                  <GitCommitHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-mono text-muted-foreground">{c.shortHash}</span>
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatTime(c.createdAt)}
                  </span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
