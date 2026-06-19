import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Entry } from "../../../../../shared/types";
import {
  getTags,
  getTickets,
  getProjects,
  getRecentTickets,
  getPinnedTickets,
  setEntryNotes,
  setEntryTags,
  updateEntry,
  assignTicket,
  removeTicket,
} from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { composeDateTime } from "./entrySchema";
import { Dialog } from "../../components/ui/dialog";
import { TagPicker } from "./TagPicker";
import { TicketPicker } from "./TicketPicker";
import { NoteQuickEdit } from "./NoteQuickEdit";
import { DateTimeQuickEdit } from "./DateTimeQuickEdit";

export type QuickEditField = "tags" | "ticket" | "notes" | "date";

interface EntryQuickEditDialogProps {
  entry: Entry | null;
  field: QuickEditField | null;
  onClose: () => void;
}

/**
 * Self-contained Quick-Edit-Modal für die Entries-Tabelle: lädt eigene Listen
 * (Tags/Tickets/Projekte) und persistiert die Änderung direkt per RPC. Welcher
 * Editor erscheint, steuert `field`. Kein Status-Guard — auch gebuchte Entries
 * lassen sich anfassen.
 */
export function EntryQuickEditDialog(props: EntryQuickEditDialogProps) {
  const qc = useQueryClient();
  const entry = props.entry;

  const tags = useQuery({ queryKey: keys.tags(), queryFn: async () => unwrap(await getTags()) });
  const activeTickets = useQuery({
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
  const pinned = useQuery({
    queryKey: keys.pinnedTickets(),
    queryFn: async () => unwrap(await getPinnedTickets()),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: keys.entries() });
  }

  // Lokaler Tag-Zustand, der bei Entry-Wechsel neu geseedet wird — sonst zeigt
  // der Dialog beim nächsten Öffnen die Tags des vorigen Entries.
  const [tagIds, setTagIds] = useState<number[]>(props.entry?.tagIds ?? []);
  const seededId = useRef<number | null>(null);
  useEffect(() => {
    const id = entry?.id ?? null;
    if (seededId.current !== id) {
      seededId.current = id;
      setTagIds(entry?.tagIds ?? []);
    }
  }, [entry]);

  const setTags = useMutation({
    mutationFn: async (args: { id: number; tagIds: number[] }) =>
      unwrap(await setEntryTags(args.id, args.tagIds)),
    onSuccess: invalidate,
    meta: { successToast: "Tags gespeichert" },
  });
  const setTicket = useMutation({
    mutationFn: async (args: { entry: Entry; ticketId: number | null }) => {
      for (const tid of args.entry.ticketIds) unwrap(await removeTicket(args.entry.id, tid));
      if (args.ticketId !== null) unwrap(await assignTicket(args.entry.id, args.ticketId));
    },
    onSuccess: invalidate,
    meta: { successToast: "Ticket gespeichert" },
  });
  const saveNotes = useMutation({
    mutationFn: async (args: { id: number; notes: string | null }) =>
      unwrap(await setEntryNotes(args.id, args.notes)),
    onSuccess: invalidate,
    meta: { successToast: "Notiz gespeichert" },
  });
  const saveDateTime = useMutation({
    mutationFn: async (args: {
      entry: Entry;
      date: string;
      startTime: string;
      endTime: string;
    }) => {
      const next = composeDateTime(args.date, args.startTime, args.endTime);
      unwrap(
        await updateEntry({
          ...args.entry,
          date: next.date,
          durationMinutes: next.durationMinutes,
        }),
      );
    },
    onSuccess: invalidate,
    meta: { successToast: "Zeit geändert" },
  });

  function onToggleTag(id: number) {
    if (entry === null) return;
    const next = tagIds.includes(id) ? tagIds.filter((t) => t !== id) : [...tagIds, id];
    setTagIds(next);
    setTags.mutate({ id: entry.id, tagIds: next });
  }

  return (
    <Dialog
      open={props.entry !== null && props.field !== null}
      onClose={props.onClose}
      size={props.field === "ticket" || props.field === "tags" ? "lg" : "md"}
    >
      {entry === null || props.field === null ? null : props.field === "tags" ? (
        <TagPicker
          tags={tags.data ?? []}
          value={tagIds}
          onToggle={onToggleTag}
          onDone={props.onClose}
        />
      ) : props.field === "ticket" ? (
        <TicketPicker
          tickets={activeTickets.data ?? []}
          projects={projects.data ?? []}
          recent={recent.data ?? []}
          pinned={pinned.data ?? []}
          value={entry.ticketIds[0] ?? null}
          onSelect={(id) => {
            setTicket.mutate({ entry, ticketId: id });
            props.onClose();
          }}
          onCancel={props.onClose}
        />
      ) : props.field === "notes" ? (
        <NoteQuickEdit
          initialNotes={entry.notes}
          pending={saveNotes.isPending}
          onSave={(notes) => {
            saveNotes.mutate({ id: entry.id, notes });
            props.onClose();
          }}
          onCancel={props.onClose}
        />
      ) : (
        <DateTimeQuickEdit
          entry={entry}
          pending={saveDateTime.isPending}
          onSave={(v) => {
            saveDateTime.mutate({ entry, ...v });
            props.onClose();
          }}
          onCancel={props.onClose}
        />
      )}
    </Dialog>
  );
}
