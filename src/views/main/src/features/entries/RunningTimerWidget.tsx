import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Square, Tags, X } from "lucide-react";
import type { Entry, EntryStart } from "../../../../../shared/types";
import { formatElapsed } from "../../../../../shared/time";
import {
  getRunningEntry,
  startEntry,
  stopEntry,
  setEntryNotes,
  setEntryTags,
  deleteEntry,
  getTickets,
  getProjects,
  getRecentTickets,
  getTags,
  assignTicket,
  removeTicket,
} from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { Dialog } from "../../components/ui/dialog";
import { TicketPicker } from "./TicketPicker";
import { TagPicker } from "./TagPicker";
import { StartTimePicker } from "./StartTimePicker";

/** Tickt jede Sekunde, solange `active` true ist — für die Live-Anzeige. */
function useTick(active: boolean): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return nowMs;
}

/**
 * Globales Timer-Widget (unten in der Sidebar, auf jeder Route sichtbar).
 * Startet/stoppt den einen laufenden Entry; übersteht App-Neustart, weil der
 * Zustand in SQLite liegt und über `getRunningEntry` geladen wird.
 */
export function RunningTimerWidget() {
  const qc = useQueryClient();
  const running = useQuery({
    queryKey: keys.runningEntry(),
    queryFn: async () => unwrap(await getRunningEntry()),
  });
  const entry = running.data ?? null;
  const nowMs = useTick(entry !== null);

  const tickets = useQuery({
    queryKey: keys.tickets({ status: "active" }),
    queryFn: async () => unwrap(await getTickets({ status: "active" })),
  });
  const projects = useQuery({
    queryKey: keys.projects(),
    queryFn: async () => unwrap(await getProjects()),
  });
  const recent = useQuery({
    queryKey: keys.recentTickets(),
    queryFn: async () => unwrap(await getRecentTickets(8)),
  });
  const tags = useQuery({
    queryKey: keys.tags(),
    queryFn: async () => unwrap(await getTags()),
  });

  const [note, setNote] = useState("");
  const [draftTicketId, setDraftTicketId] = useState<number | null>(null);
  const [draftTagIds, setDraftTagIds] = useState<number[]>([]);
  const [picking, setPicking] = useState(false);
  const [pickingTags, setPickingTags] = useState(false);
  const [backdate, setBackdate] = useState<Date | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const norm = (s: string | null) => (s ?? "").trim();

  // Notizfeld mit der Notiz des laufenden Entries seeden — nur wenn sich der
  // Entry wechselt (nicht bei jedem Sekunden-Tick), sonst überschreibt es Tippen.
  const seededId = useRef<number | null>(null);
  useEffect(() => {
    const id = entry?.id ?? null;
    if (seededId.current !== id) {
      seededId.current = id;
      setNote(entry?.notes ?? "");
    }
  }, [entry]);
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  function invalidate() {
    qc.invalidateQueries({ queryKey: keys.runningEntry() });
    qc.invalidateQueries({ queryKey: keys.entries() });
  }

  const start = useMutation({
    mutationFn: async () => {
      const args: EntryStart = {
        ticketId: draftTicketId,
        notes: note.trim() || null,
        tagIds: draftTagIds,
      };
      // Rückdatierung nur übernehmen, wenn sie tatsächlich in der Vergangenheit
      // liegt — sonst Schlüssel weglassen (Backend/Tests erwarten exakt
      // {ticketId, notes, tagIds} ohne startAt).
      if (backdate && backdate.getTime() < Date.now()) args.startAt = backdate.toISOString();
      return unwrap(await startEntry(args));
    },
    onSuccess: () => {
      setDraftTicketId(null);
      setDraftTagIds([]);
      setBackdate(null);
      invalidate();
    },
    meta: { successToast: "Timer gestartet" },
  });
  const stop = useMutation({
    mutationFn: async (id: number) => unwrap(await stopEntry(id)),
    onSuccess: invalidate,
    meta: { successToast: "Gestoppt — als Entwurf gespeichert" },
  });
  // Notiz-Autosave: rührt nur das Notizfeld an; invalidiert nur den laufenden
  // Entry (nicht die Tabelle), damit das Tippen flüssig bleibt. Kein Toast (zu
  // häufig); auch Fehler bleiben still, um nicht bei jedem Tastendruck zu nerven.
  const saveNotes = useMutation({
    mutationFn: async (args: { id: number; notes: string | null }) =>
      unwrap(await setEntryNotes(args.id, args.notes)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.runningEntry() }),
    meta: { silentError: true },
  });

  // Beim Tippen 600ms debounced speichern; onBlur und Stop flushen sofort.
  function onNoteChange(value: string) {
    setNote(value);
    if (!entry) return;
    clearTimeout(saveTimer.current);
    const id = entry.id;
    saveTimer.current = setTimeout(
      () => saveNotes.mutate({ id, notes: value.trim() || null }),
      600,
    );
  }
  function flushNotes() {
    if (!entry) return;
    clearTimeout(saveTimer.current);
    if (norm(note) !== norm(entry.notes)) {
      saveNotes.mutate({ id: entry.id, notes: note.trim() || null });
    }
  }
  async function handleStop() {
    if (!entry) return;
    clearTimeout(saveTimer.current);
    if (norm(note) !== norm(entry.notes)) {
      await saveNotes.mutateAsync({ id: entry.id, notes: note.trim() || null });
    }
    stop.mutate(entry.id);
  }
  // Verwerfen: löscht den laufenden Entry komplett (statt Stop → Entwurf).
  const discard = useMutation({
    mutationFn: async (id: number) => unwrap(await deleteEntry(id)),
    onSuccess: invalidate,
    meta: { successToast: "Timer verworfen" },
  });
  function handleDiscard() {
    if (!entry) return;
    clearTimeout(saveTimer.current);
    if (window.confirm("Laufenden Timer verwerfen? Die erfasste Zeit geht verloren.")) {
      discard.mutate(entry.id);
    }
  }
  const setTicket = useMutation({
    mutationFn: async (args: { entry: Entry; ticketId: number | null }) => {
      for (const tid of args.entry.ticketIds) unwrap(await removeTicket(args.entry.id, tid));
      if (args.ticketId !== null) unwrap(await assignTicket(args.entry.id, args.ticketId));
    },
    onSuccess: invalidate,
  });

  // Tags ersetzen das ganze Set in einem RPC (Set-Semantik) — passt zur
  // Mehrfachauswahl besser als ein assign/remove-Paar wie beim Ticket.
  const setTags = useMutation({
    mutationFn: async (args: { id: number; tagIds: number[] }) =>
      unwrap(await setEntryTags(args.id, args.tagIds)),
    onSuccess: invalidate,
  });

  const activeTicketId = entry ? (entry.ticketIds[0] ?? null) : draftTicketId;
  const ticket = (tickets.data ?? []).find((t) => t.id === activeTicketId) ?? null;
  const ticketLabel = ticket ? `#${ticket.gitlabIid} ${ticket.title}` : "Ticket wählen";

  const activeTagIds = entry ? entry.tagIds : draftTagIds;
  const tagLabel = activeTagIds.length > 0 ? `Tags (${activeTagIds.length})` : "Tags wählen";

  function onPick(id: number | null) {
    if (entry) setTicket.mutate({ entry, ticketId: id });
    else setDraftTicketId(id);
    setPicking(false);
  }

  function onToggleTag(id: number) {
    const next = activeTagIds.includes(id)
      ? activeTagIds.filter((t) => t !== id)
      : [...activeTagIds, id];
    if (entry) setTags.mutate({ id: entry.id, tagIds: next });
    else setDraftTagIds(next);
  }

  return (
    <div className="mt-auto border-t border-border p-3">
      {entry ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-success-solid" />
            <span className="font-mono text-lg font-semibold tabular-nums">
              {formatElapsed(nowMs - new Date(entry.date).getTime())}
            </span>
            <button
              type="button"
              onClick={handleDiscard}
              disabled={discard.isPending}
              title="Timer verwerfen"
              aria-label="Timer verwerfen"
              className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            onBlur={flushNotes}
            rows={2}
            placeholder="Notiz…"
            className="w-full resize-none rounded-md border border-input bg-card px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="block w-full truncate rounded border border-border px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
          >
            {ticketLabel}
          </button>
          <button
            type="button"
            onClick={() => setPickingTags(true)}
            className="flex w-full items-center gap-1.5 truncate rounded border border-border px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
          >
            <Tags className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {tagLabel}
          </button>
          <button
            type="button"
            onClick={handleStop}
            disabled={stop.isPending}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-danger-solid px-3 py-2 text-sm font-medium text-danger-solid-foreground hover:bg-danger-solid/90 disabled:opacity-50"
          >
            <Square className="h-3.5 w-3.5 fill-current" /> Stop
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") start.mutate();
            }}
            placeholder="Woran arbeitest du?"
            className="h-8 w-full rounded-md border border-input bg-card px-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="block w-full truncate rounded border border-border px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
          >
            {ticketLabel}
          </button>
          <button
            type="button"
            onClick={() => setPickingTags(true)}
            className="flex w-full items-center gap-1.5 truncate rounded border border-border px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
          >
            <Tags className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {tagLabel}
          </button>
          <StartTimePicker value={backdate} onChange={setBackdate} />
          <button
            type="button"
            onClick={() => start.mutate()}
            disabled={start.isPending}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5 fill-current" /> Start
          </button>
        </div>
      )}

      <Dialog open={picking} onClose={() => setPicking(false)} size="lg">
        <TicketPicker
          tickets={tickets.data ?? []}
          projects={projects.data ?? []}
          recent={recent.data ?? []}
          value={activeTicketId}
          onSelect={onPick}
          onCancel={() => setPicking(false)}
        />
      </Dialog>

      <Dialog open={pickingTags} onClose={() => setPickingTags(false)} size="lg">
        <TagPicker
          tags={tags.data ?? []}
          value={activeTagIds}
          onToggle={onToggleTag}
          onDone={() => setPickingTags(false)}
        />
      </Dialog>
    </div>
  );
}
