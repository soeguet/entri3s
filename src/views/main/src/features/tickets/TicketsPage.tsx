import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RefreshCw } from "lucide-react";
import type {
  Project,
  Ticket,
  TicketFilter,
  TicketState,
  TicketStatus,
} from "../../../../../shared/types";
import {
  getTickets,
  getProjects,
  triggerSync,
  getCurrentUser,
  pinTicket,
  unpinTicket,
  markAllTicketsRead,
} from "../../api";
import { keys } from "../../lib/queryKeys";
import type { SyncStatus } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { buildProjectTree } from "../../lib/projectTree";
import { Button } from "../../components/ui/button";
import { formatDuration } from "../../lib/dates";
import { PageHeader } from "../../components/PageHeader";
import { ErrorNote } from "../../components/ErrorNote";
import { Badge } from "../../components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "../../components/ui/table";
import { TicketTree } from "./TicketTree";
import { TicketsToolbar } from "./TicketsToolbar";
import { AssigneeCell } from "./AssigneeCell";
import { PinButton } from "./PinButton";

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
    tickets: [...ts].sort((a, b) =>
      a.pinned === b.pinned ? b.gitlabIid - a.gitlabIid : a.pinned ? -1 : 1,
    ),
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
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const filter: TicketFilter = {};
  if (status) filter.status = status;
  if (state) filter.state = state;
  if (assignedToMe) filter.assignedToMe = true;
  if (pinnedOnly) filter.pinned = true;
  if (unreadOnly) filter.unread = true;

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

  const markAllRead = useMutation({
    mutationFn: async () => unwrap(await markAllTicketsRead()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.tickets() });
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
          <TicketsToolbar
            search={search}
            setSearch={setSearch}
            status={status}
            setStatus={setStatus}
            state={state}
            setState={setState}
            assignedToMe={assignedToMe}
            setAssignedToMe={setAssignedToMe}
            currentUserAvailable={Boolean(currentUser.data)}
            pinnedOnly={pinnedOnly}
            setPinnedOnly={setPinnedOnly}
            unreadOnly={unreadOnly}
            setUnreadOnly={setUnreadOnly}
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
                  <TH>IID</TH>
                  <TH>Titel</TH>
                  <TH>Status</TH>
                  <TH>State</TH>
                  <TH>Zugewiesen</TH>
                  <TH>Estimate</TH>
                  <TH>Gebucht</TH>
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

function ProjectGroup(props: {
  group: Group;
  pinPending: boolean;
  onTogglePin: (ticket: Ticket) => void;
}) {
  return (
    <>
      <TR className="bg-muted">
        <TD colSpan={9} className="py-1.5">
          <span className="font-medium text-foreground">{props.group.name}</span>
          <span className="ml-2 font-mono text-xs text-muted-foreground">{props.group.path}</span>
        </TD>
      </TR>
      {props.group.tickets.map((ticket) => (
        <TR key={ticket.id} className={ticket.status === "orphaned" ? "opacity-50" : ""}>
          <TD className="font-mono">
            {ticket.unread ? (
              <span
                className="mr-1.5 inline-block h-2 w-2 rounded-full bg-info-accent align-middle"
                aria-label="Ungelesen"
                title="Ungelesen"
              />
            ) : null}
            #{ticket.gitlabIid}
          </TD>
          <TD>{ticket.title}</TD>
          <TD>
            {ticket.status === "orphaned" ? (
              <Badge variant="destructive">Archiviert</Badge>
            ) : (
              <Badge variant="success">Aktiv</Badge>
            )}
          </TD>
          <TD>{ticket.state}</TD>
          <TD>
            <AssigneeCell assignees={ticket.assignees} />
          </TD>
          <TD>{seconds(ticket.timeEstimate)}</TD>
          <TD>{seconds(ticket.timeSpent)}</TD>
          <TD>
            <PinButton
              pinned={ticket.pinned}
              disabled={props.pinPending}
              onToggle={() => props.onTogglePin(ticket)}
            />
          </TD>
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
