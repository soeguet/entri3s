import { useEffect, useState } from "react";
import { StickyNote } from "lucide-react";
import type { TodoPriority, TodoTask, TodoTaskPatch } from "../../../../../shared/types";
import { Dialog } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Select } from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { todoErrorMessage } from "./todoError";

interface TaskDetailDialogProps {
  open: boolean;
  task: TodoTask | null;
  subtasks: TodoTask[];
  onClose: () => void;
  onUpdate: (patch: TodoTaskPatch) => void;
  onAddSubtask: (title: string) => void;
  onToggleSubtask: (task: TodoTask) => void;
  // Öffnet das Detail des Subtasks (Modal schaltet auf diesen Task um).
  onOpenSubtask: (task: TodoTask) => void;
  error: unknown;
}

const PRIORITY_LABEL: Record<TodoPriority, string> = {
  highest: "🔺 Höchste",
  high: "⏫ Hoch",
  medium: "🔼 Mittel",
  normal: "Normal",
  low: "🔽 Niedrig",
  lowest: "⏬ Niedrigste",
};

// Tag-Konvention im Dialog: Leerzeichen-getrennt OHNE "#" (z.B. "arbeit backend").
// Das "#" gehört zur Markdown-Darstellung, nicht zur Eingabe — TodoTask.tags
// speichert ohnehin ohne "#".
export function TaskDetailDialog(props: TaskDetailDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("normal");
  const [tagsText, setTagsText] = useState("");
  const [due, setDue] = useState("");
  const [scheduled, setScheduled] = useState("");
  const [newSubtask, setNewSubtask] = useState("");

  // Draft bei Wechsel des Tasks (per id) aus props.task neu initialisieren.
  const taskId = props.task?.id ?? null;
  useEffect(() => {
    const t = props.task;
    if (!t) return;
    setTitle(t.title);
    setDescription(t.description ?? "");
    setPriority(t.priority);
    setTagsText(t.tags.join(" "));
    setDue(t.due ?? "");
    setScheduled(t.scheduled ?? "");
    setNewSubtask("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  if (!props.task) return null;
  const task = props.task;

  function save() {
    const patch: TodoTaskPatch = {
      id: task.id,
      listId: task.listId,
      title: title.trim() === "" ? task.title : title.trim(),
      description: description.trim() === "" ? null : description,
      priority,
      due: due === "" ? null : due,
      scheduled: scheduled === "" ? null : scheduled,
      tags: tagsText.split(/\s+/).filter((t) => t !== ""),
    };
    props.onUpdate(patch);
  }

  function addSubtask() {
    const t = newSubtask.trim();
    if (t === "") return;
    props.onAddSubtask(t);
    setNewSubtask("");
  }

  return (
    <Dialog open={props.open} onClose={props.onClose} title="Aufgabe" size="lg">
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="td-title">Titel</Label>
          <Input id="td-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="td-desc">Beschreibung</Label>
          <Textarea
            id="td-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <Label htmlFor="td-prio">Priorität</Label>
            <Select
              id="td-prio"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TodoPriority)}
            >
              {(Object.keys(PRIORITY_LABEL) as TodoPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="td-tags">Tags</Label>
            <Input
              id="td-tags"
              value={tagsText}
              placeholder="arbeit backend"
              onChange={(e) => setTagsText(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <Label htmlFor="td-due">Fällig</Label>
            <Input id="td-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="td-scheduled">Geplant</Label>
            <Input
              id="td-scheduled"
              type="date"
              value={scheduled}
              onChange={(e) => setScheduled(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Subtasks</Label>
          <div role="list" className="space-y-1">
            {props.subtasks.map((st) => {
              const note = st.description !== null && st.description.trim() !== "";
              return (
                // Checkbox (Abhaken) und Titel (Detail öffnen) sind getrennte
                // Controls — daher kein <label>, sonst würde ein Titel-Klick die
                // Checkbox togglen.
                <div key={st.id} className="flex items-start gap-2 text-sm" role="listitem">
                  <input
                    type="checkbox"
                    checked={st.done}
                    aria-label={`${st.title} abhaken`}
                    onChange={() => props.onToggleSubtask(st)}
                    className="mt-1 shrink-0"
                  />
                  <button
                    type="button"
                    onClick={() => props.onOpenSubtask(st)}
                    className="flex min-w-0 flex-1 flex-col items-start text-left"
                  >
                    <span className={st.done ? "text-muted-foreground line-through" : undefined}>
                      {st.title}
                    </span>
                    {note ? (
                      <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                        <StickyNote className="h-3 w-3 shrink-0" />
                        <span className="truncate">{st.description}</span>
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Input
              value={newSubtask}
              placeholder="Subtask hinzufügen…"
              aria-label="Neuer Subtask"
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addSubtask();
              }}
            />
            <Button variant="outline" onClick={addSubtask}>
              Hinzufügen
            </Button>
          </div>
        </div>

        {props.error ? (
          <p className="text-xs text-danger-accent">{todoErrorMessage(props.error)}</p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={props.onClose}>
            Schließen
          </Button>
          <Button onClick={save}>Speichern</Button>
        </div>
      </div>
    </Dialog>
  );
}
