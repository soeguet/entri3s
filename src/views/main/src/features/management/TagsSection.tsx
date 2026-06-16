import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { getTags, createTag, deleteTag } from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";

const PALETTE = ["#3b82f6", "#ef4444", "#a855f7", "#22c55e", "#f59e0b", "#64748b"];

export function TagsSection() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);

  const tags = useQuery({ queryKey: keys.tags(), queryFn: async () => unwrap(await getTags()) });

  const create = useMutation({
    mutationFn: async () => unwrap(await createTag({ name: name.trim(), color })),
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: keys.tags() });
    },
  });
  const remove = useMutation({
    mutationFn: async (id: number) => unwrap(await deleteTag(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.tags() }),
  });

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-lg font-semibold">Tags</h2>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="tag-name">Name</Label>
          <Input id="tag-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="tag-color">Farbe</Label>
          <Select id="tag-color" value={color} onChange={(e) => setColor(e.target.value)}>
            {PALETTE.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <Button disabled={name.trim() === "" || create.isPending} onClick={() => create.mutate()}>
          Hinzufügen
        </Button>
      </div>

      <ul className="flex flex-wrap gap-2">
        {(tags.data ?? []).map((tag) => (
          <li
            key={tag.id}
            className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-sm"
          >
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: tag.color ?? "#cbd5e1" }}
            />
            {tag.name}
            <button
              onClick={() => {
                if (window.confirm(`Tag "${tag.name}" löschen?`)) remove.mutate(tag.id);
              }}
              className="text-slate-400 hover:text-red-600"
              aria-label={`Tag ${tag.name} löschen`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
