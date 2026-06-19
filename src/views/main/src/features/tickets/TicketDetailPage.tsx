import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
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
import { ErrorNote } from "../../components/ErrorNote";
import { CommentThread } from "./CommentThread";
import { GitlabContent } from "./GitlabContent";
import { TicketMeta } from "./TicketMeta";
import { TicketDetailHeader } from "./TicketDetailHeader";
import { TicketDetailToolbar } from "./TicketDetailToolbar";

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
        <BackLink />
        <ErrorNote error={ticket.error ?? "Ticket nicht gefunden."} className="mt-3" />
      </div>
    );
  }

  const t = ticket.data;

  return (
    <div>
      <BackLink />

      <div className="mt-3 space-y-4">
        <TicketDetailHeader
          ticket={t}
          pinPending={pin.isPending}
          onTogglePin={() => pin.mutate({ pinned: t.pinned })}
        />
        <TicketDetailToolbar
          webUrl={t.webUrl}
          markReadPending={markRead.isPending}
          syncPending={manualSync.isPending}
          onMarkRead={() => markRead.mutate()}
          onSync={() => manualSync.mutate()}
        />
      </div>

      {markRead.isError ? <ErrorNote error={markRead.error} className="mt-4" /> : null}
      {manualSync.isError ? <ErrorNote error={manualSync.error} className="mt-4" /> : null}
      {pin.isError ? <ErrorNote error={pin.error} className="mt-4" /> : null}
      {comments.isError ? <ErrorNote error={comments.error} className="mt-4" /> : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Beschreibung
            </h2>
            {t.descriptionHtml ? (
              <GitlabContent html={t.descriptionHtml} />
            ) : (
              <p className="text-sm text-muted-foreground">Keine Beschreibung.</p>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Kommentare
            </h2>
            {comments.isLoading ? (
              <p className="text-sm text-muted-foreground">Lädt…</p>
            ) : (
              <CommentThread comments={comments.data ?? []} lastViewedAt={t.lastViewedAt} />
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <TicketMeta ticket={t} />
        </aside>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/tickets"
      className="inline-flex items-center gap-1 text-sm text-info-accent hover:underline"
    >
      <ArrowLeft className="h-4 w-4" />
      Zurück zu Tickets
    </Link>
  );
}
