import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Square, X } from "lucide-react";
import type { Entry } from "../../../../../shared/types";
import {
  getRunningEntry,
  startEntry,
  stopEntry,
  setEntryNotes,
  deleteEntry,
  getTickets,
  getProjects,
  getRecentTickets,
  assignTicket,
  removeTicket,
} from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { Dialog } from "../../components/ui/dialog";
import { TicketPicker } from "./TicketPicker";

/** Millisekunden → "HH:MM:SS". */
function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

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

  const [note, setNote] = useState("");
  const [draftTicketId, setDraftTicketId] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
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
    mutationFn: async () =>
      unwrap(await startEntry({ ticketId: draftTicketId, notes: note.trim() || null })),
    onSuccess: () => {
      setDraftTicketId(null);
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

  const activeTicketId = entry ? (entry.ticketIds[0] ?? null) : draftTicketId;
  const ticket = (tickets.data ?? []).find((t) => t.id === activeTicketId) ?? null;
  const ticketLabel = ticket ? `#${ticket.gitlabIid} ${ticket.title}` : "Ticket wählen";

  function onPick(id: number | null) {
    if (entry) setTicket.mutate({ entry, ticketId: id });
    else setDraftTicketId(id);
    setPicking(false);
  }

  return (
    <div className="mt-auto border-t border-border p-3">
      {entry ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
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
            onClick={handleStop}
            disabled={stop.isPending}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
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
    </div>
  );
}
