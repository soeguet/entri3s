import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, GitCommitHorizontal } from "lucide-react";
import type { Entry } from "../../../../../shared/types";
import {
  createEntry,
  updateEntry,
  getTags,
  getTickets,
  getTemplates,
  getProjects,
  getRecentTickets,
  getPinnedTickets,
} from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap, errorMessage } from "../../lib/errors";
import { parsePayload } from "../../lib/templatePayload";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Select } from "../../components/ui/select";
import { TicketPicker } from "./TicketPicker";
import { CommitPicker } from "./CommitPicker";
import {
  entrySchema,
  makeEmptyFormValues,
  toEntryCreate,
  toFormValues,
  type EntryFormValues,
} from "./entrySchema";
import { EntryDateTimeFields } from "./EntryDateTimeFields";

interface EntryFormProps {
  open: boolean;
  onClose: () => void;
  entry?: Entry;
  duplicateFrom?: Entry;
  defaultDate?: string;
}

export function EntryForm(props: EntryFormProps) {
  const qc = useQueryClient();
  const form = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: props.entry
      ? toFormValues(props.entry)
      : props.duplicateFrom
        ? {
            ...toFormValues(props.duplicateFrom),
            date: props.defaultDate ?? toFormValues(props.duplicateFrom).date,
          }
        : makeEmptyFormValues({ date: props.defaultDate }),
  });

  const tags = useQuery({ queryKey: keys.tags(), queryFn: async () => unwrap(await getTags()) });
  const tickets = useQuery({
    queryKey: keys.tickets({ status: "active" }),
    queryFn: async () => unwrap(await getTickets({ status: "active" })),
  });
  const projects = useQuery({
    queryKey: keys.projects(),
    queryFn: async () => unwrap(await getProjects()),
  });
  const recentTickets = useQuery({
    queryKey: keys.recentTickets(),
    queryFn: async () => unwrap(await getRecentTickets(8)),
  });
  const pinned = useQuery({
    queryKey: keys.pinnedTickets(),
    queryFn: async () => unwrap(await getPinnedTickets()),
  });
  const templates = useQuery({
    queryKey: keys.templates(),
    queryFn: async () => unwrap(await getTemplates()),
    enabled: !props.entry,
  });

  function applyTemplate(templateId: string) {
    const template = (templates.data ?? []).find((t) => String(t.id) === templateId);
    if (!template) return;
    const payload = parsePayload(template.payload);
    const start = form.getValues("startTime");
    if (!/^\d{2}:\d{2}$/.test(start)) return;
    const [sh, sm] = start.split(":").map(Number);
    const end = sh * 60 + sm + payload.durationMinutes;
    form.setValue("notes", payload.notes ?? "");
    form.setValue("tagIds", payload.tagIds);
    form.setValue(
      "endTime",
      `${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`,
    );
  }

  const mutation = useMutation({
    mutationFn: async (values: EntryFormValues) => {
      const base = toEntryCreate(values);
      if (props.entry) {
        unwrap(await updateEntry({ ...props.entry, ...base, status: props.entry.status }));
      } else {
        unwrap(await createEntry(base));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.entries() });
      props.onClose();
    },
    // OVERLAP & Co. werden inline unter dem Formular angezeigt → kein doppelter
    // Error-Toast aus dem zentralen MutationCache.
    meta: { silentError: true, successToast: props.entry ? "Gespeichert" : "Entry angelegt" },
  });

  const [picking, setPicking] = useState(false);
  const [pickingCommits, setPickingCommits] = useState(false);

  const selectedTags = form.watch("tagIds");
  const ticketId = form.watch("ticketId");

  const selectedTicket =
    ticketId === null ? null : ((tickets.data ?? []).find((t) => t.id === ticketId) ?? null);
  function projectName(id: number): string {
    return (projects.data ?? []).find((p) => p.id === id)?.name ?? `Projekt ${id}`;
  }

  function toggleTag(id: number) {
    const next = selectedTags.includes(id)
      ? selectedTags.filter((t) => t !== id)
      : [...selectedTags, id];
    form.setValue("tagIds", next);
  }

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      size="lg"
      title={
        picking || pickingCommits ? undefined : props.entry ? "Entry bearbeiten" : "Neuer Entry"
      }
    >
      {pickingCommits ? (
        <CommitPicker
          date={form.watch("date")}
          projects={projects.data ?? []}
          onApply={(messages) => {
            const current = form.getValues("notes") ?? "";
            const append = messages.map((m) => `- ${m}`).join("\n");
            const next = current ? `${current}\n${append}` : append;
            form.setValue("notes", next);
            setPickingCommits(false);
          }}
          onCancel={() => setPickingCommits(false)}
        />
      ) : picking ? (
        <TicketPicker
          tickets={tickets.data ?? []}
          projects={projects.data ?? []}
          recent={recentTickets.data ?? []}
          pinned={pinned.data ?? []}
          value={ticketId}
          onSelect={(id) => {
            form.setValue("ticketId", id);
            setPicking(false);
          }}
          onCancel={() => setPicking(false)}
        />
      ) : (
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              if (mutation.isPending) return;
              form.handleSubmit((v) => mutation.mutate(v))();
            }
          }}
        >
          {!props.entry && (templates.data ?? []).length > 0 ? (
            <div>
              <Label htmlFor="template">Template anwenden</Label>
              <Select id="template" defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">– kein Template –</option>
                {(templates.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <EntryDateTimeFields form={form} />

          <div>
            <Label htmlFor="notes">Notizen</Label>
            <Textarea id="notes" {...form.register("notes")} />
          </div>

          {(projects.data ?? []).length > 0 ? (
            <div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPickingCommits(true)}
                className="w-full justify-start gap-2 text-muted-foreground"
              >
                <GitCommitHorizontal className="h-4 w-4" />
                Commits anzeigen
              </Button>
            </div>
          ) : null}

          <div>
            <Label htmlFor="ticket">Ticket</Label>
            <button
              id="ticket"
              type="button"
              onClick={() => setPicking(true)}
              className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={
                  selectedTicket ? "truncate text-foreground" : "truncate text-muted-foreground"
                }
              >
                {selectedTicket
                  ? `#${selectedTicket.gitlabIid} ${selectedTicket.title} · ${projectName(selectedTicket.projectId)}`
                  : "– kein Ticket –"}
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </div>

          <div>
            <Label>Tags</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {(tags.data ?? []).map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={
                    "rounded-full border px-3 py-1 text-xs font-medium " +
                    (selectedTags.includes(tag.id)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input text-muted-foreground")
                  }
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          {mutation.isError ? (
            <p className="text-sm text-danger-accent">{errorMessage(mutation.error)}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={props.onClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {props.entry ? "Speichern" : "Erstellen"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
