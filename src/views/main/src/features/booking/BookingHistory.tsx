import { useQuery } from "@tanstack/react-query";
import type { Booking, Ticket } from "../../../../../shared/types";
import { getBookingsForEntry } from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { formatDate, formatDuration } from "../../lib/dates";

interface BookingHistoryProps {
  entryId: number;
  ticketsById: Map<number, Ticket>;
}

/** Link auf die konkrete GitLab-Note, abgeleitet aus der web_url des Tickets. */
function gitlabNoteUrl(ticket: Ticket | undefined, booking: Booking): string | null {
  return ticket?.webUrl ? `${ticket.webUrl}#note_${booking.gitlabNoteId}` : null;
}

export function BookingHistory(props: BookingHistoryProps) {
  const bookings = useQuery({
    queryKey: keys.bookings(props.entryId),
    queryFn: async () => unwrap(await getBookingsForEntry(props.entryId)),
  });

  if (bookings.isLoading) {
    return <p className="text-xs text-slate-400">Lädt Buchungen…</p>;
  }

  if (bookings.isError) {
    return <p className="text-xs text-red-600">Buchungen konnten nicht geladen werden.</p>;
  }

  const list = bookings.data ?? [];
  if (list.length === 0) {
    return <p className="text-xs text-slate-400">Gebucht vor Tracking – keine Note verlinkt.</p>;
  }

  return (
    <ul className="space-y-2">
      {list.map((booking) => {
        const url = gitlabNoteUrl(props.ticketsById.get(booking.ticketId), booking);
        return (
          <li key={booking.id} className="text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <span className="font-medium">{formatDate(booking.spentAt)}</span>
              <span className="text-slate-400">·</span>
              <span>{formatDuration(booking.durationMinutes)}</span>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Note #{booking.gitlabNoteId} ↗
                </a>
              ) : (
                <span className="text-slate-400">Note #{booking.gitlabNoteId}</span>
              )}
            </div>
            {booking.note ? (
              <p className="whitespace-pre-line text-xs text-slate-500">{booking.note}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
