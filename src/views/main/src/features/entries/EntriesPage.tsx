import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fromZonedTime } from "date-fns-tz";
import type { Entry, EntryFilter, EntryStatus } from "../../../../../shared/types";
import { getEntries, getTickets, deleteEntry, bookEntry } from "../../api";
import { keys } from "../../lib/queryKeys";
import { errorMessage, unwrap } from "../../lib/errors";
import { PageHeader } from "../../components/PageHeader";
import { Button } from "../../components/ui/button";
import { Select } from "../../components/ui/select";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { EntryList } from "./EntryList";
import { EntryForm } from "./EntryForm";

const TZ = "Europe/Berlin";

function dayStart(date: string): string {
  return fromZonedTime(`${date}T00:00:00`, TZ).toISOString();
}
function dayEnd(date: string): string {
  return fromZonedTime(`${date}T23:59:59`, TZ).toISOString();
}

export function EntriesPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<EntryStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | undefined>(undefined);

  const filter: EntryFilter = {};
  if (status) filter.status = status;
  if (from) filter.dateFrom = dayStart(from);
  if (to) filter.dateTo = dayEnd(to);

  const entries = useQuery({
    queryKey: keys.entries(filter),
    queryFn: async () => unwrap(await getEntries(filter)),
  });
  const tickets = useQuery({
    queryKey: keys.tickets(),
    queryFn: async () => unwrap(await getTickets({})),
  });

  const ticketsById = new Map((tickets.data ?? []).map((t) => [t.id, t]));

  const remove = useMutation({
    mutationFn: async (id: number) => unwrap(await deleteEntry(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.entries() }),
  });
  const book = useMutation({
    mutationFn: async (id: number) => unwrap(await bookEntry(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.entries() }),
  });

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }
  function openEdit(entry: Entry) {
    setEditing(entry);
    setFormOpen(true);
  }
  function confirmDelete(entry: Entry) {
    if (window.confirm(`Entry "${entry.title}" löschen?`)) remove.mutate(entry.id);
  }

  return (
    <div>
      <PageHeader
        title="Entries"
        description="Arbeitszeiten erfassen und buchen"
        actions={<Button onClick={openCreate}>Neuer Entry</Button>}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="f-status">Status</Label>
          <Select
            id="f-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as EntryStatus | "")}
          >
            <option value="">Alle</option>
            <option value="draft">Entwurf</option>
            <option value="pending_booking">Buchung läuft</option>
            <option value="booked">Gebucht</option>
            <option value="orphaned">Verwaist</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="f-from">Von</Label>
          <Input id="f-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="f-to">Bis</Label>
          <Input id="f-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {book.isError ? (
        <p className="mb-3 text-sm text-red-600">{errorMessage(book.error)}</p>
      ) : null}

      {entries.isLoading ? (
        <p className="py-10 text-center text-sm text-slate-400">Lädt…</p>
      ) : (
        <EntryList
          entries={entries.data ?? []}
          ticketsById={ticketsById}
          onEdit={openEdit}
          onDelete={confirmDelete}
          onBook={(entry) => book.mutate(entry.id)}
        />
      )}

      {formOpen ? (
        <EntryForm open={formOpen} onClose={() => setFormOpen(false)} entry={editing} />
      ) : null}
    </div>
  );
}
