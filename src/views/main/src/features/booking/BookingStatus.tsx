import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDeadEvents, retryDeadEvent } from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { formatDateTime } from "../../lib/dates";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";

export function BookingStatus() {
  const qc = useQueryClient();
  const events = useQuery({
    queryKey: keys.deadEvents(),
    queryFn: async () => unwrap(await getDeadEvents()),
  });

  const retry = useMutation({
    mutationFn: async (id: number) => unwrap(await retryDeadEvent(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.deadEvents() }),
  });

  if (events.isLoading) {
    return <p className="py-10 text-center text-sm text-slate-400">Lädt…</p>;
  }

  if ((events.data ?? []).length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-400">Keine fehlgeschlagenen Buchungen.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {(events.data ?? []).map((event) => (
        <li
          key={event.id}
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4"
        >
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="destructive">{event.type}</Badge>
              <span className="text-xs text-slate-400">{formatDateTime(event.createdAt)}</span>
            </div>
            <p className="mt-1 text-sm text-slate-700">{event.error ?? "Unbekannter Fehler"}</p>
          </div>
          <Button size="sm" disabled={retry.isPending} onClick={() => retry.mutate(event.id)}>
            Erneut versuchen
          </Button>
        </li>
      ))}
    </ul>
  );
}
