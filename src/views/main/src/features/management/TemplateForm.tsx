import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Template } from "../../../../../shared/types";
import { getTags, createTemplate, updateTemplate } from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { parsePayload, buildPayload } from "../../lib/templatePayload";

interface TemplateFormProps {
  open: boolean;
  onClose: () => void;
  template?: Template;
}

export function TemplateForm(props: TemplateFormProps) {
  const qc = useQueryClient();
  const initial = props.template ? parsePayload(props.template.payload) : null;
  const [name, setName] = useState(props.template?.name ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [duration, setDuration] = useState(initial?.durationMinutes ?? 60);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [tagIds, setTagIds] = useState<number[]>(initial?.tagIds ?? []);

  const tags = useQuery({ queryKey: keys.tags(), queryFn: async () => unwrap(await getTags()) });

  const save = useMutation({
    mutationFn: async () => {
      const payload = buildPayload({
        title,
        durationMinutes: duration,
        notes: notes || null,
        tagIds,
      });
      if (props.template) {
        unwrap(await updateTemplate({ id: props.template.id, name: name.trim(), payload }));
      } else {
        unwrap(await createTemplate({ name: name.trim(), payload }));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.templates() });
      props.onClose();
    },
  });

  function toggleTag(id: number) {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title={props.template ? "Template bearbeiten" : "Neues Template"}
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="tpl-name">Template-Name</Label>
          <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="tpl-title">Entry-Titel</Label>
          <Input id="tpl-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="tpl-dur">Dauer (Minuten)</Label>
          <Input
            id="tpl-dur"
            type="number"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="tpl-notes">Notizen</Label>
          <Textarea id="tpl-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
                  (tagIds.includes(tag.id)
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
          <Button variant="outline" onClick={props.onClose}>
            Abbrechen
          </Button>
          <Button disabled={name.trim() === "" || save.isPending} onClick={() => save.mutate()}>
            Speichern
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
