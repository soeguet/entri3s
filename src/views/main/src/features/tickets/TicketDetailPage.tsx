import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import {
  getTicket,
  getTicketComments,
  syncTicketComments,
  markTicketRead,
  pinTicket,
  unpinTicket,
} from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { Button } from "../../components/ui/button";
import { ErrorNote } from "../../components/ErrorNote";
import { AssigneeCell } from "./AssigneeCell";
import { PinButton } from "./PinButton";
import { CommentThread } from "./CommentThread";

export function TicketDetailPage() {
  const params = useParams({ from: "/tickets/$ticketId" });
  const ticketId = Number(params.ticketId);
  const qc = useQueryClient();

  const ticket = useQuery({
    queryKey: keys.ticketDetail(ticketId),
    queryFn: async () => unwrap(await getTicket(ticketId)),
  });

  const comments = useQuery({
    queryKey: keys.ticketComments(ticketId),
    queryFn: async () => unwrap(await getTicketComments(ticketId)),
  });

  // Beim Öffnen einmal pro ticketId einen Sync anstoßen (markiert NICHT als gelesen).
  const autoSync = useMutation({
    mutationFn: async () => unwrap(await syncTicketComments(ticketId)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.ticketComments(ticketId) }),
  });

  useEffect(() => {
    autoSync.mutate();
    // Bewusst nur ticketId als Dependency — ein Sync pro Ticket-Öffnung.
    // autoSync ist über die Query-Client-Instanz stabil.
  }, [ticketId]);

  const manualSync = useMutation({
    mutationFn: async () => unwrap(await syncTicketComments(ticketId)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.ticketComments(ticketId) }),
  });

  const markRead = useMutation({
    mutationFn: async () => unwrap(await markTicketRead(ticketId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.ticketDetail(ticketId) });
      qc.invalidateQueries({ queryKey: keys.tickets() });
      qc.invalidateQueries({ queryKey: keys.ticketComments(ticketId) });
    },
  });

  const pin = useMutation({
    mutationFn: async (vars: { pinned: boolean }) =>
      unwrap(vars.pinned ? await unpinTicket(ticketId) : await pinTicket(ticketId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.ticketDetail(ticketId) });
      qc.invalidateQueries({ queryKey: keys.tickets() });
      qc.invalidateQueries({ queryKey: keys.pinnedTickets() });
    },
  });

  if (ticket.isLoading) {
    return <p className="py-10 text-sm text-muted-foreground">Lädt…</p>;
  }

  if (ticket.isError || ticket.data == null) {
    return (
      <div>
        <Link to="/tickets" className="text-sm text-info-accent hover:underline">
          ← Zurück zu Tickets
        </Link>
        <ErrorNote error={ticket.error ?? "Ticket nicht gefunden."} className="mt-3" />
      </div>
    );
  }

  const t = ticket.data;

  return (
    <div>
      <Link to="/tickets" className="text-sm text-info-accent hover:underline">
        ← Zurück zu Tickets
      </Link>

      <div className="mt-3 mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-muted-foreground">#{t.gitlabIid}</span>
            <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <AssigneeCell assignees={t.assignees} />
            {t.webUrl ? (
              <a
                href={t.webUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-info-accent hover:underline"
              >
                In GitLab öffnen
              </a>
            ) : null}
          </div>
        </div>
        <PinButton
          pinned={t.pinned}
          disabled={pin.isPending}
          onToggle={() => pin.mutate({ pinned: t.pinned })}
        />
      </div>

      <div className="mb-6 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={markRead.isPending}
          onClick={() => markRead.mutate()}
        >
          Als gelesen markieren
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={manualSync.isPending}
          onClick={() => manualSync.mutate()}
        >
          <RefreshCw className={"h-4 w-4 " + (manualSync.isPending ? "animate-spin" : "")} />
          Kommentare aktualisieren
        </Button>
      </div>

      {markRead.isError ? <ErrorNote error={markRead.error} className="mb-3" /> : null}
      {manualSync.isError ? <ErrorNote error={manualSync.error} className="mb-3" /> : null}
      {pin.isError ? <ErrorNote error={pin.error} className="mb-3" /> : null}
      {comments.isError ? <ErrorNote error={comments.error} className="mb-3" /> : null}

      <CommentThread comments={comments.data ?? []} lastViewedAt={t.lastViewedAt} />
    </div>
  );
}
