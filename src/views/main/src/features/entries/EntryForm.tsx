import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Entry } from "../../../../../shared/types";
import { createEntry, updateEntry, getTags, getTickets, getTemplates } from "../../api";
import { keys } from "../../lib/queryKeys";
import { RpcError, unwrap } from "../../lib/errors";
import { parsePayload } from "../../lib/templatePayload";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Select } from "../../components/ui/select";
import {
  entrySchema,
  emptyFormValues,
  toEntryCreate,
  toFormValues,
  type EntryFormValues,
} from "./entrySchema";

interface EntryFormProps {
  open: boolean;
  onClose: () => void;
  entry?: Entry;
}

export function EntryForm(props: EntryFormProps) {
  const qc = useQueryClient();
  const form = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: props.entry ? toFormValues(props.entry) : emptyFormValues,
  });

  const tags = useQuery({ queryKey: keys.tags(), queryFn: async () => unwrap(await getTags()) });
  const tickets = useQuery({
    queryKey: keys.tickets({ status: "active" }),
    queryFn: async () => unwrap(await getTickets({ status: "active" })),
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
    form.setValue("title", payload.title);
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
    onError: (err) => {
      if (err instanceof RpcError && err.code === "OVERLAP") {
        form.setError("startTime", { message: "Überschneidung mit bestehendem Entry" });
      }
    },
  });

  const selectedTags = form.watch("tagIds");
  const ticketId = form.watch("ticketId");

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
      title={props.entry ? "Entry bearbeiten" : "Neuer Entry"}
    >
      <form className="space-y-4" onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
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

        <div>
          <Label htmlFor="title">Titel</Label>
          <Input id="title" {...form.register("title")} />
          <FieldError message={form.formState.errors.title?.message} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="date">Datum</Label>
            <Input id="date" type="date" {...form.register("date")} />
          </div>
          <div>
            <Label htmlFor="startTime">Start</Label>
            <Input id="startTime" type="time" {...form.register("startTime")} />
          </div>
          <div>
            <Label htmlFor="endTime">Ende</Label>
            <Input id="endTime" type="time" {...form.register("endTime")} />
          </div>
        </div>
        <FieldError message={form.formState.errors.endTime?.message} />
        <FieldError message={form.formState.errors.startTime?.message} />

        <div>
          <Label htmlFor="notes">Notizen</Label>
          <Textarea id="notes" {...form.register("notes")} />
        </div>

        <div>
          <Label htmlFor="ticket">Ticket</Label>
          <Select
            id="ticket"
            value={ticketId === null ? "" : String(ticketId)}
            onChange={(e) =>
              form.setValue("ticketId", e.target.value === "" ? null : Number(e.target.value))
            }
          >
            <option value="">– kein Ticket –</option>
            {(tickets.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                #{t.gitlabIid} {t.title}
              </option>
            ))}
          </Select>
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
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 text-slate-600")
                }
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={props.onClose}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {props.entry ? "Speichern" : "Erstellen"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function FieldError(props: { message?: string }) {
  if (!props.message) return null;
  return <p className="mt-1 text-xs text-red-600">{props.message}</p>;
}
