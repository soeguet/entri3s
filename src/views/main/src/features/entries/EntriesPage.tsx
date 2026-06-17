import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fromZonedTime } from "date-fns-tz";
import type { Entry, EntryFilter, EntryStatus } from "../../../../../shared/types";
import { getEntries, getTickets, deleteEntry, bookEntry } from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { formatDuration, rangeForPreset, type RangePreset } from "../../lib/dates";
import { PageHeader } from "../../components/PageHeader";
import { ErrorNote } from "../../components/ErrorNote";
import { Button } from "../../components/ui/button";
import { Select } from "../../components/ui/select";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { EntryList } from "./EntryList";
import { EntryForm } from "./EntryForm";
import { GapBanner } from "./GapBanner";

const TZ = "Europe/Berlin";

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "today", label: "Heute" },
  { key: "thisWeek", label: "Diese Woche" },
  { key: "lastWeek", label: "Letzte Woche" },
  { key: "thisMonth", label: "Dieser Monat" },
  { key: "lastMonth", label: "Letzter Monat" },
];

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
  const [activePreset, setActivePreset] = useState<RangePreset | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | undefined>(undefined);

  function applyPreset(preset: RangePreset) {
    const range = rangeForPreset(preset);
    setFrom(range.from);
    setTo(range.to);
    setActivePreset(preset);
  }
  function clearRange() {
    setFrom("");
    setTo("");
    setActivePreset(null);
  }

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
  // Der laufende Entry wird im globalen Timer-Widget gezeigt, nicht in der Tabelle.
  const visible = (entries.data ?? []).filter((e) => e.status !== "running");
  const totalMinutes = visible.reduce((sum, e) => sum + e.durationMinutes, 0);

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
    if (window.confirm(`Entry #${entry.id} löschen?`)) remove.mutate(entry.id);
  }

  return (
    <div>
      <PageHeader
        title="Entries"
        description="Arbeitszeiten erfassen und buchen"
        actions={<Button onClick={openCreate}>Neuer Entry</Button>}
      />

      <div className="mb-3 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.key}
            size="sm"
            variant={activePreset === preset.key ? "default" : "outline"}
            onClick={() => applyPreset(preset.key)}
          >
            {preset.label}
          </Button>
        ))}
        {from || to ? (
          <Button size="sm" variant="ghost" onClick={clearRange}>
            Zurücksetzen
          </Button>
        ) : null}
      </div>

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
            <option value="booking_failed">Buchung fehlgeschlagen</option>
            <option value="orphaned">Verwaist</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="f-from">Von</Label>
          <Input
            id="f-from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setActivePreset(null);
            }}
          />
        </div>
        <div>
          <Label htmlFor="f-to">Bis</Label>
          <Input
            id="f-to"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setActivePreset(null);
            }}
          />
        </div>
      </div>

      <GapBanner />

      {book.isError ? <ErrorNote error={book.error} className="mb-3" /> : null}
      {remove.isError ? <ErrorNote error={remove.error} className="mb-3" /> : null}
      {entries.isError ? <ErrorNote error={entries.error} className="mb-3" /> : null}

      {entries.isLoading ? (
        <p className="py-10 text-center text-sm text-slate-400">Lädt…</p>
      ) : (
        <>
          {visible.length > 0 ? (
            <p className="mb-2 text-sm text-slate-500">
              {visible.length} {visible.length === 1 ? "Eintrag" : "Einträge"} · Summe{" "}
              <span className="font-medium text-slate-700">{formatDuration(totalMinutes)}</span>
            </p>
          ) : null}
          <EntryList
            entries={visible}
            ticketsById={ticketsById}
            onEdit={openEdit}
            onDelete={confirmDelete}
            onBook={(entry) => book.mutate(entry.id)}
          />
        </>
      )}

      {formOpen ? (
        <EntryForm open={formOpen} onClose={() => setFormOpen(false)} entry={editing} />
      ) : null}
    </div>
  );
}
