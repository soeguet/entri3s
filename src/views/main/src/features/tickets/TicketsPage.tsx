import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, Search } from "lucide-react";
import type {
  Project,
  Ticket,
  TicketFilter,
  TicketState,
  TicketStatus,
} from "../../../../../shared/types";
import { getTickets, getProjects, triggerSync } from "../../api";
import { keys } from "../../lib/queryKeys";
import type { SyncStatus } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { buildProjectTree } from "../../lib/projectTree";
import { Button } from "../../components/ui/button";
import { formatDuration } from "../../lib/dates";
import { PageHeader } from "../../components/PageHeader";
import { ErrorNote } from "../../components/ErrorNote";
import { Select } from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "../../components/ui/table";
import { TicketTree } from "./TicketTree";

function seconds(s: number | null): string {
  return s == null ? "–" : formatDuration(Math.round(s / 60));
}

/** Projekt-Pfad gehört zur Auswahl (exakt = Projektblatt, Prefix = Gruppe). */
function inSelection(projectPath: string, selectedPath: string | null): boolean {
  if (!selectedPath) return true;
  return projectPath === selectedPath || projectPath.startsWith(`${selectedPath}/`);
}

interface Group {
  path: string;
  name: string;
  tickets: Ticket[];
}

function groupByProject(tickets: Ticket[], byId: Map<number, Project>): Group[] {
  const map = new Map<number, Ticket[]>();
  for (const t of tickets) {
    const list = map.get(t.projectId) ?? [];
    list.push(t);
    map.set(t.projectId, list);
  }
  const groups = [...map.entries()].map(([pid, ts]) => ({
    path: byId.get(pid)?.fullPath ?? `Projekt ${pid}`,
    name: byId.get(pid)?.name ?? `Projekt ${pid}`,
    tickets: [...ts].sort((a, b) => b.gitlabIid - a.gitlabIid),
  }));
  groups.sort((a, b) => a.path.localeCompare(b.path));
  return groups;
}

export function TicketsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<TicketStatus | "">("active");
  const [state, setState] = useState<TicketState | "">("");
  const [search, setSearch] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const filter: TicketFilter = {};
  if (status) filter.status = status;
  if (state) filter.state = state;

  const tickets = useQuery({
    queryKey: keys.tickets(filter),
    queryFn: async () => unwrap(await getTickets(filter)),
  });
  const projects = useQuery({
    queryKey: keys.projects(),
    queryFn: async () => unwrap(await getProjects()),
  });

  const syncStatus = useQuery({
    queryKey: keys.syncStatus(),
    queryFn: (): SyncStatus => ({ error: null }),
    staleTime: Infinity,
  });

  const sync = useMutation({
    mutationFn: async () => unwrap(await triggerSync()),
    onMutate: () => qc.setQueryData<SyncStatus>(keys.syncStatus(), { error: null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.tickets() });
      qc.invalidateQueries({ queryKey: keys.projects() });
    },
  });

  const allTickets = tickets.data ?? [];
  const projectList = projects.data ?? [];
  const byId = new Map(projectList.map((p) => [p.id, p]));

  // Counts für den Baum: über den (status/state-)gefilterten Bestand, vor Suche/Auswahl.
  const counts = new Map<number, number>();
  for (const t of allTickets) counts.set(t.projectId, (counts.get(t.projectId) ?? 0) + 1);
  const tree = buildProjectTree(projectList, counts);

  const q = search.trim().toLowerCase();
  const visible = allTickets.filter((t) => {
    const path = byId.get(t.projectId)?.fullPath ?? "";
    if (!inSelection(path, selectedPath)) return false;
    if (!q) return true;
    return `#${t.gitlabIid} ${t.title} ${path}`.toLowerCase().includes(q);
  });
  const groups = groupByProject(visible, byId);

  return (
    <div>
      <PageHeader
        title="Tickets"
        description="Aus GitLab synchronisierte Issues (read-only)"
        actions={
          <Button disabled={sync.isPending} onClick={() => sync.mutate()}>
            <RefreshCw className={"h-4 w-4 " + (sync.isPending ? "animate-spin" : "")} />
            Sync
          </Button>
        }
      />

      {sync.isError ? <ErrorNote error={sync.error} className="mb-3" /> : null}
      {syncStatus.data?.error ? <ErrorNote error={syncStatus.data.error} className="mb-3" /> : null}
      {tickets.isError ? <ErrorNote error={tickets.error} className="mb-3" /> : null}

      <div className="flex gap-6">
        <aside className="w-60 shrink-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Projekte & Gruppen
          </p>
          <TicketTree nodes={tree} selectedPath={selectedPath} onSelect={setSelectedPath} />
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <Label htmlFor="t-search">Suche</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  id="t-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="#IID, Titel oder Projekt…"
                  className="h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="t-status">Status</Label>
              <Select
                id="t-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TicketStatus | "")}
              >
                <option value="">Alle</option>
                <option value="active">Aktiv</option>
                <option value="orphaned">Archiviert</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="t-state">GitLab-State</Label>
              <Select
                id="t-state"
                value={state}
                onChange={(e) => setState(e.target.value as TicketState | "")}
              >
                <option value="">Alle</option>
                <option value="opened">opened</option>
                <option value="closed">closed</option>
                <option value="locked">locked</option>
              </Select>
            </div>
          </div>

          {tickets.isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Lädt…</p>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {allTickets.length === 0 ? "Keine Tickets. Sync ausführen." : "Kein Treffer."}
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>IID</TH>
                  <TH>Titel</TH>
                  <TH>Status</TH>
                  <TH>State</TH>
                  <TH>Estimate</TH>
                  <TH>Gebucht</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {groups.map((group) => (
                  <ProjectGroup key={group.path} group={group} />
                ))}
              </TBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectGroup(props: { group: Group }) {
  return (
    <>
      <TR className="bg-muted">
        <TD colSpan={7} className="py-1.5">
          <span className="font-medium text-foreground">{props.group.name}</span>
          <span className="ml-2 font-mono text-xs text-muted-foreground">{props.group.path}</span>
        </TD>
      </TR>
      {props.group.tickets.map((ticket) => (
        <TR key={ticket.id} className={ticket.status === "orphaned" ? "opacity-50" : ""}>
          <TD className="font-mono">#{ticket.gitlabIid}</TD>
          <TD>{ticket.title}</TD>
          <TD>
            {ticket.status === "orphaned" ? (
              <Badge variant="destructive">Archiviert</Badge>
            ) : (
              <Badge variant="success">Aktiv</Badge>
            )}
          </TD>
          <TD>{ticket.state}</TD>
          <TD>{seconds(ticket.timeEstimate)}</TD>
          <TD>{seconds(ticket.timeSpent)}</TD>
          <TD>
            {ticket.webUrl ? (
              <a
                href={ticket.webUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </TD>
        </TR>
      ))}
    </>
  );
}
