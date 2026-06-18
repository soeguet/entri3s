import { useState } from "react";

interface DateQuickEditProps {
  initialYmd: string;
  pending: boolean;
  onSave: (ymd: string) => void;
  onCancel: () => void;
}

/**
 * Präsentationaler Datums-Editor fürs Inline-Quick-Edit. Ändert nur das
 * Kalenderdatum; die Uhrzeit des Entries bleibt erhalten (siehe withDate).
 */
export function DateQuickEdit(props: DateQuickEditProps) {
  const [ymd, setYmd] = useState(props.initialYmd);

  return (
    <div>
      <h3 className="mb-3 text-base font-semibold">Datum ändern</h3>
      <input
        type="date"
        value={ymd}
        onChange={(e) => setYmd(e.target.value)}
        className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <p className="mt-2 text-sm text-muted-foreground">Uhrzeit bleibt erhalten.</p>
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
          onClick={() => props.onSave(ymd)}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Speichern
        </button>
      </div>
    </div>
  );
}
