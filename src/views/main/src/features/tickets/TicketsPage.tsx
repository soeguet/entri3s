import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import type { Project, Ticket, TicketFilter } from "../../../../../shared/types";
import {
  getTickets,
  getProjects,
  triggerSync,
  getCurrentUser,
  pinTicket,
  unpinTicket,
  markAllTicketsRead,
  getUnreadCount,
} from "../../api";
import { keys } from "../../lib/queryKeys";
import type { SyncStatus } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { buildProjectTree } from "../../lib/projectTree";
import { Button } from "../../components/ui/button";
import { PageHeader } from "../../components/PageHeader";
import { ErrorNote } from "../../components/ErrorNote";
import { Badge } from "../../components/ui/badge";
import { Table, THead, TBody, TR, TH } from "../../components/ui/table";
import { TicketTree } from "./TicketTree";
import { TicketsToolbar } from "./TicketsToolbar";
import { ProjectGroup, type Group } from "./ProjectGroup";
import { SortableTH } from "./SortableTH";
import { sortTickets, type TicketSortBy, type TicketSortDir } from "./ticketsSort";
import { useTicketsSearch } from "./useTicketsSearch";

// Tabellenkopf: by=null → nicht sortierbar (Assignee bewusst ohne Sortierung).
const SORT_COLUMNS: { by: TicketSortBy | null; label: string }[] = [
  { by: "iid", label: "IID" },
  { by: "title", label: "Titel" },
  { by: "status", label: "Status" },
  { by: "state", label: "State" },
  { by: null, label: "Zugewiesen" },
  { by: "estimate", label: "Estimate" },
  { by: "spent", label: "Gebucht" },
];

/** Projekt-Pfad gehört zur Auswahl (exakt = Projektblatt, Prefix = Gruppe). */
function inSelection(projectPath: string, selectedPath: string | null): boolean {
  if (!selectedPath) return true;
  return projectPath === selectedPath || projectPath.startsWith(`${selectedPath}/`);
}

function groupByProject(
  tickets: Ticket[],
  byId: Map<number, Project>,
  sortBy: TicketSortBy,
  sortDir: TicketSortDir,
): Group[] {
  const map = new Map<number, Ticket[]>();
  for (const t of tickets) {
    const list = map.get(t.projectId) ?? [];
    list.push(t);
    map.set(t.projectId, list);
  }
  const groups = [...map.entries()].map(([pid, ts]) => ({
    path: byId.get(pid)?.fullPath ?? `Projekt ${pid}`,
    name: byId.get(pid)?.name ?? `Projekt ${pid}`,
    tickets: sortTickets(ts, sortBy, sortDir),
  }));
  groups.sort((a, b) => a.path.localeCompare(b.path));
  return groups;
}

export function TicketsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  // Filter/Suche/Auswahl/Sortierung kommen aus den URL-Search-Params (siehe router.tsx),
  // damit sie beim Zurücknavigieren aus der Detailseite erhalten bleiben.
  const { search: params, update, toggleSort } = useTicketsSearch();

  const filter: TicketFilter = {};
  if (params.status) filter.status = params.status;
  if (params.state) filter.state = params.state;
  if (params.assignedToMe) filter.assignedToMe = true;
  if (params.pinnedOnly) filter.pinned = true;
  if (params.unreadOnly) filter.unread = true;

  const tickets = useQuery({
    queryKey: keys.tickets(filter),
    queryFn: async () => unwrap(await getTickets(filter)),
  });
  const projects = useQuery({
    queryKey: keys.projects(),
    queryFn: async () => unwrap(await getProjects()),
  });
  const currentUser = useQuery({
    queryKey: keys.currentUser(),
    queryFn: async () => unwrap(await getCurrentUser()),
  });
  // Globaler ungelesen-Zähler (ungefiltert) für das Badge am Sync-Button.
  const unreadCount = useQuery({
    queryKey: keys.unreadCount(),
    queryFn: async () => unwrap(await getUnreadCount()),
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
      qc.invalidateQueries({ queryKey: keys.unreadCount() });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => unwrap(await markAllTicketsRead(filter)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.tickets() });
      qc.invalidateQueries({ queryKey: keys.unreadCount() });
    },
  });

  const pin = useMutation({
    mutationFn: async (vars: { id: number; pinned: boolean }) =>
      unwrap(vars.pinned ? await unpinTicket(vars.id) : await pinTicket(vars.id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.tickets() });
      qc.invalidateQueries({ queryKey: keys.pinnedTickets() });
    },
  });

  const allTickets = tickets.data ?? [];
  const projectList = projects.data ?? [];
  const byId = new Map(projectList.map((p) => [p.id, p]));

  // Counts für den Baum: über den (status/state-)gefilterten Bestand, vor Suche/Auswahl.
  const counts = new Map<number, number>();
  for (const t of allTickets) counts.set(t.projectId, (counts.get(t.projectId) ?? 0) + 1);
  const tree = buildProjectTree(projectList, counts);

  const q = params.search.trim().toLowerCase();
  const visible = allTickets.filter((t) => {
    const path = byId.get(t.projectId)?.fullPath ?? "";
    if (!inSelection(path, params.selectedPath)) return false;
    if (!q) return true;
    return `#${t.gitlabIid} ${t.title} ${path}`.toLowerCase().includes(q);
  });
  const groups = groupByProject(visible, byId, params.sortBy, params.sortDir);

  return (
    <div>
      <PageHeader
        title="Tickets"
        description="Aus GitLab synchronisierte Issues (read-only)"
        actions={
          <div className="flex items-center gap-2">
            {unreadCount.data ? (
              <Badge
                variant="secondary"
                className="bg-info-surface text-info-accent"
                aria-label={`${unreadCount.data} ungelesen`}
              >
                {unreadCount.data} ungelesen
              </Badge>
            ) : null}
            <Button disabled={sync.isPending} onClick={() => sync.mutate()}>
              <RefreshCw className={"h-4 w-4 " + (sync.isPending ? "animate-spin" : "")} />
              Sync
            </Button>
          </div>
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
          <TicketTree
            nodes={tree}
            selectedPath={params.selectedPath}
            onSelect={(p) => update({ selectedPath: p })}
          />
        </aside>

        <div className="min-w-0 flex-1">
          <TicketsToolbar
            search={params.search}
            setSearch={(v) => update({ search: v })}
            status={params.status}
            setStatus={(v) => update({ status: v })}
            state={params.state}
            setState={(v) => update({ state: v })}
            assignedToMe={params.assignedToMe}
            setAssignedToMe={(v) => update({ assignedToMe: v })}
            currentUserAvailable={Boolean(currentUser.data)}
            pinnedOnly={params.pinnedOnly}
            setPinnedOnly={(v) => update({ pinnedOnly: v })}
            unreadOnly={params.unreadOnly}
            setUnreadOnly={(v) => update({ unreadOnly: v })}
            onMarkAllRead={() => markAllRead.mutate()}
            markAllReadPending={markAllRead.isPending}
          />

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
                  {SORT_COLUMNS.map((col) =>
                    col.by ? (
                      <SortableTH
                        key={col.label}
                        by={col.by}
                        label={col.label}
                        activeBy={params.sortBy}
                        dir={params.sortDir}
                        onSort={toggleSort}
                      />
                    ) : (
                      <TH key={col.label}>{col.label}</TH>
                    ),
                  )}
                  <TH></TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {groups.map((group) => (
                  <ProjectGroup
                    key={group.path}
                    group={group}
                    pinPending={pin.isPending}
                    onTogglePin={(t) => pin.mutate({ id: t.id, pinned: t.pinned })}
                    onOpen={(t) =>
                      navigate({ to: "/tickets/$ticketId", params: { ticketId: String(t.id) } })
                    }
                  />
                ))}
              </TBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
