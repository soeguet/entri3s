import { useState } from "react";

interface NoteQuickEditProps {
  initialNotes: string | null;
  pending: boolean;
  onSave: (notes: string | null) => void;
  onCancel: () => void;
}

/**
 * Präsentationaler Notiz-Editor fürs Inline-Quick-Edit im Modal. Hält nur den
 * lokalen Entwurf; das Speichern/Persistieren übernimmt der Parent-Dialog.
 */
export function NoteQuickEdit(props: NoteQuickEditProps) {
  const [value, setValue] = useState(props.initialNotes ?? "");

  return (
    <div>
      <h3 className="mb-3 text-base font-semibold">Notiz bearbeiten</h3>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={5}
        placeholder="Notiz…"
        className="w-full resize-none rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={props.onCancel}
          className="rounded-md border border-input px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
        >
          Abbrechen
        </button>
        <button
          type="button"
          disabled={props.pending}
          onClick={() => props.onSave(value.trim() === "" ? null : value.trim())}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Speichern
        </button>
      </div>
    </div>
  );
}
