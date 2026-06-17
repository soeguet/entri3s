import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Template } from "../../../../../shared/types";
import { getTemplates, deleteTemplate } from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { formatDuration } from "../../lib/dates";
import { Button } from "../../components/ui/button";
import { TemplateForm } from "./TemplateForm";
import { parsePayload } from "../../lib/templatePayload";

export function TemplatesSection() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Template | undefined>(undefined);

  const templates = useQuery({
    queryKey: keys.templates(),
    queryFn: async () => unwrap(await getTemplates()),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => unwrap(await deleteTemplate(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.templates() }),
    meta: { successToast: "Template gelöscht" },
  });

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }
  function openEdit(template: Template) {
    setEditing(template);
    setFormOpen(true);
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Templates</h2>
        <Button size="sm" onClick={openCreate}>
          Neues Template
        </Button>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        Templates lassen sich beim Anlegen eines Entries auswählen und vorbefüllen.
      </p>

      <ul className="divide-y divide-border">
        {(templates.data ?? []).map((template) => {
          const payload = parsePayload(template.payload);
          return (
            <li key={template.id} className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">{template.name}</p>
                <p className="text-xs text-muted-foreground">
                  {payload.notes || "(ohne Notiz)"} · {formatDuration(payload.durationMinutes)}
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(template)}>
                  Bearbeiten
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(`Template "${template.name}" löschen?`))
                      remove.mutate(template.id);
                  }}
                >
                  Löschen
                </Button>
              </div>
            </li>
          );
        })}
        {(templates.data ?? []).length === 0 ? (
          <li className="py-4 text-sm text-muted-foreground">Keine Templates.</li>
        ) : null}
      </ul>

      {formOpen ? (
        <TemplateForm open={formOpen} onClose={() => setFormOpen(false)} template={editing} />
      ) : null}
    </section>
  );
}
