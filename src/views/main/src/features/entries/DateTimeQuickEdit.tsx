import { useState } from "react";
import type { Entry } from "../../../../../shared/types";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toFormValues, previewDurationMinutes } from "./entrySchema";
import { formatDuration, roundUpToQuarterHour } from "../../lib/dates";

interface DateTimeQuickEditProps {
  entry: Entry;
  pending: boolean;
  onSave: (v: { date: string; startTime: string; endTime: string }) => void;
  onCancel: () => void;
}

/**
 * Präsentationaler Datum/Uhrzeit-Editor fürs Inline-Quick-Edit im Modal. Hält
 * nur den lokalen Entwurf; das Speichern/Persistieren übernimmt der Parent.
 */
export function DateTimeQuickEdit(props: DateTimeQuickEditProps) {
  const [state, setState] = useState(() => {
    const v = toFormValues(props.entry);
    return { date: v.date, startTime: v.startTime, endTime: v.endTime };
  });

  const previewMinutes = previewDurationMinutes(state.startTime, state.endTime);

  return (
    <div>
      <h3 className="mb-3 text-base font-semibold">Datum &amp; Uhrzeit ändern</h3>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="date">Datum</Label>
          <Input
            id="date"
            type="date"
            value={state.date}
            onChange={(e) => setState({ ...state, date: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="startTime">Start</Label>
          <Input
            id="startTime"
            type="time"
            value={state.startTime}
            onChange={(e) => setState({ ...state, startTime: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="endTime">Ende</Label>
          <Input
            id="endTime"
            type="time"
            value={state.endTime}
            onChange={(e) => setState({ ...state, endTime: e.target.value })}
          />
        </div>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {previewMinutes === null ? (
          <span className="text-muted-foreground">Dauer: –</span>
        ) : (
          <>
            Dauer:{" "}
            <span className="font-medium text-foreground">{formatDuration(previewMinutes)}</span>
            {roundUpToQuarterHour(previewMinutes) !== previewMinutes ? (
              <span className="text-muted-foreground">
                {" "}
                → {formatDuration(roundUpToQuarterHour(previewMinutes))} gebucht
              </span>
            ) : null}
          </>
        )}
      </p>
      {previewMinutes === null ? (
        <p className="mt-1 text-xs text-danger-accent">Ende muss nach Start liegen</p>
      ) : null}

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
          disabled={props.pending || previewMinutes === null}
          onClick={() =>
            props.onSave({
              date: state.date,
              startTime: state.startTime,
              endTime: state.endTime,
            })
          }
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Speichern
        </button>
      </div>
    </div>
  );
}
