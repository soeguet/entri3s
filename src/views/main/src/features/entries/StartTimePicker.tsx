import { Clock } from "lucide-react";
import { formatTime, formatDuration } from "../../lib/dates";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

interface StartTimePickerProps {
  value: Date | null; // gewählter rückdatierter Start (null = "Jetzt")
  onChange: (next: Date | null) => void;
}

/**
 * Wählt einen rückdatierten Start für einen neuen Timer. Erlaubt nie einen Start
 * in der Zukunft — die exakte Uhrzeit-Eingabe fällt in dem Fall auf "Jetzt"
 * (null) zurück.
 */
export function StartTimePicker(props: StartTimePickerProps) {
  // Effektiver Start = gewählter Wert oder jetzt. Kein Tick — bei jedem Render
  // neu berechnet, das reicht für die Anzeige der vergangenen Minuten.
  const effective = props.value ?? new Date();

  function shift(minutes: number) {
    props.onChange(new Date(effective.getTime() - minutes * 60000));
  }

  function onPickTime(hhmm: string) {
    if (!hhmm) return;
    const ymd = formatInTimeZone(new Date(), "Europe/Berlin", "yyyy-MM-dd");
    const candidate = fromZonedTime(`${ymd}T${hhmm}:00`, "Europe/Berlin");
    // Nie in die Zukunft starten — sonst auf "Jetzt" zurückfallen.
    if (candidate.getTime() > Date.now()) props.onChange(null);
    else props.onChange(candidate);
  }

  return (
    <div className="space-y-1.5 rounded border border-border p-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        {props.value === null ? (
          <>
            <Clock className="h-3.5 w-3.5" /> Jetzt
          </>
        ) : (
          <span>
            gestartet {formatTime(props.value.toISOString())} · vor{" "}
            {formatDuration(Math.max(0, Math.floor((Date.now() - props.value.getTime()) / 60000)))}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => shift(5)}
          className="rounded border border-border px-2 py-1 hover:bg-muted"
        >
          -5
        </button>
        <button
          type="button"
          onClick={() => shift(15)}
          className="rounded border border-border px-2 py-1 hover:bg-muted"
        >
          -15
        </button>
        <button
          type="button"
          onClick={() => shift(30)}
          className="rounded border border-border px-2 py-1 hover:bg-muted"
        >
          -30
        </button>
        <button
          type="button"
          onClick={() => props.onChange(null)}
          className="rounded border border-border px-2 py-1 hover:bg-muted"
        >
          Jetzt
        </button>
        <input
          type="time"
          value={formatTime(effective.toISOString())}
          onChange={(e) => onPickTime(e.target.value)}
          className="ml-auto rounded border border-border bg-card px-1.5 py-1 text-foreground"
        />
      </div>
    </div>
  );
}
