import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { discardDeadEvent, getDeadEvents, retryDeadEvent } from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { formatDateTime } from "../../lib/dates";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { ErrorNote } from "../../components/ErrorNote";

/** Interner Event-Typ → für den Nutzer verständliches Label. */
function eventLabel(type: string): string {
  if (type === "booking") return "Buchung fehlgeschlagen";
  if (type === "booking_delete") return "Stornierung fehlgeschlagen";
  return type;
}

export function BookingStatus() {
  const qc = useQueryClient();
  const events = useQuery({
    queryKey: keys.deadEvents(),
    queryFn: async () => unwrap(await getDeadEvents()),
  });

  const retry = useMutation({
    mutationFn: async (id: number) => unwrap(await retryDeadEvent(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.deadEvents() }),
    // Fehler wird inline (ErrorNote) angezeigt → kein doppelter Toast.
    meta: { silentError: true, successToast: "Erneut eingereiht" },
  });

  const discard = useMutation({
    mutationFn: async (id: number) => unwrap(await discardDeadEvent(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.deadEvents() }),
    meta: { silentError: true, successToast: "Verworfen" },
  });

  if (events.isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Lädt…</p>;
  }

  if (events.isError) {
    return <ErrorNote error={events.error} className="py-10 text-center" />;
  }

  if ((events.data ?? []).length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Keine fehlgeschlagenen Buchungen.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {retry.isError ? <ErrorNote error={retry.error} /> : null}
      {discard.isError ? <ErrorNote error={discard.error} /> : null}
      {(events.data ?? []).map((event) => (
        <li
          key={event.id}
          className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4"
        >
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="destructive">{eventLabel(event.type)}</Badge>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(event.createdAt)}
              </span>
            </div>
            <p className="mt-1 text-sm text-foreground">{event.error ?? "Unbekannter Fehler"}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              disabled={retry.isPending || discard.isPending}
              onClick={() => retry.mutate(event.id)}
            >
              Erneut versuchen
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={retry.isPending || discard.isPending}
              onClick={() => discard.mutate(event.id)}
            >
              Verwerfen
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
