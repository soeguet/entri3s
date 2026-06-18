import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Ticket } from "../../../../../shared/types";
import { deleteBooking, getBookingsForEntry } from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { formatDate, formatDuration } from "../../lib/dates";
import { Button } from "../../components/ui/button";

interface BookingHistoryProps {
  entryId: number;
  ticketsById: Map<number, Ticket>;
}

export function BookingHistory(props: BookingHistoryProps) {
  const qc = useQueryClient();
  const bookings = useQuery({
    queryKey: keys.bookings(props.entryId),
    queryFn: async () => unwrap(await getBookingsForEntry(props.entryId)),
  });

  const remove = useMutation({
    mutationFn: async (bookingId: number) => unwrap(await deleteBooking(bookingId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.bookings(props.entryId) });
      qc.invalidateQueries({ queryKey: keys.entries() });
    },
    meta: { successToast: "Buchung gelöscht" },
  });

  if (bookings.isLoading) {
    return <p className="text-xs text-muted-foreground">Lädt Buchungen…</p>;
  }

  if (bookings.isError) {
    return (
      <p className="text-xs text-danger-accent">Buchungen konnten nicht geladen werden.</p>
    );
  }

  const list = bookings.data ?? [];
  if (list.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">Gebucht vor Tracking – kein Timelog verlinkt.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {list.map((booking) => {
        const url = props.ticketsById.get(booking.ticketId)?.webUrl ?? null;
        return (
          <li key={booking.id} className="text-sm text-foreground">
            <div className="flex items-center gap-2">
              <span className="font-medium">{formatDate(booking.spentAt)}</span>
              <span className="text-muted-foreground">·</span>
              <span>{formatDuration(booking.durationMinutes)}</span>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-info-accent hover:underline"
                >
                  Timelog #{booking.gitlabTimelogId} ↗
                </a>
              ) : (
                <span className="text-muted-foreground">Timelog #{booking.gitlabTimelogId}</span>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={remove.isPending}
                onClick={() => remove.mutate(booking.id)}
              >
                Löschen
              </Button>
            </div>
            {booking.note ? (
              <p className="whitespace-pre-line text-xs text-muted-foreground">{booking.note}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
