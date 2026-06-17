import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RefreshCw } from "lucide-react";
import type { TicketFilter, TicketState, TicketStatus } from "../../../../../shared/types";
import { getTickets, triggerSync } from "../../api";
import { keys } from "../../lib/queryKeys";
import type { SyncStatus } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { Button } from "../../components/ui/button";
import { formatDuration } from "../../lib/dates";
import { PageHeader } from "../../components/PageHeader";
import { ErrorNote } from "../../components/ErrorNote";
import { Select } from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "../../components/ui/table";

function seconds(s: number | null): string {
  return s == null ? "–" : formatDuration(Math.round(s / 60));
}

export function TicketsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [state, setState] = useState<TicketState | "">("");

  const filter: TicketFilter = {};
  if (status) filter.status = status;
  if (state) filter.state = state;

  const tickets = useQuery({
    queryKey: keys.tickets(filter),
    queryFn: async () => unwrap(await getTickets(filter)),
  });

  // triggerSync kehrt sofort zurück (Fire-and-Forget); Erfolg/Fehler kommen
  // asynchron als Event und landen unter keys.syncStatus im Cache.
  const syncStatus = useQuery({
    queryKey: keys.syncStatus(),
    queryFn: (): SyncStatus => ({ error: null }),
    staleTime: Infinity,
  });

  const sync = useMutation({
    mutationFn: async () => unwrap(await triggerSync()),
    onMutate: () => qc.setQueryData<SyncStatus>(keys.syncStatus(), { error: null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.tickets() }),
  });

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

      <div className="mb-4 flex flex-wrap items-end gap-3">
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
        <p className="py-10 text-center text-sm text-slate-400">Lädt…</p>
      ) : (tickets.data ?? []).length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">Keine Tickets. Sync ausführen.</p>
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
            {(tickets.data ?? []).map((ticket) => (
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
                      className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
