import { Popover } from "../../components/ui/popover";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { reschedulePresetDate, todayBerlinYmd, type ReschedulePreset } from "../../lib/dates";

interface TodoDatePickerProps {
  open: boolean;
  anchor: HTMLElement | null;
  // Aktuell gesetztes Fälligkeitsdatum (yyyy-MM-dd) oder null.
  due: string | null;
  onClose: () => void;
  // null = Fälligkeit entfernen.
  onPick: (due: string | null) => void;
}

const PRESETS: Array<{ preset: ReschedulePreset; label: string }> = [
  { preset: "today", label: "Heute" },
  { preset: "tomorrow", label: "Morgen" },
  { preset: "nextWeek", label: "Nächste Woche" },
  { preset: "weekend", label: "Wochenende" },
];

// Datums-/Reschedule-Picker für einen Task: 1-Klick-Presets (Snooze) plus eine
// freie Datumseingabe. Reine UI — die Mutation triggert der Aufrufer in onPick.
export function TodoDatePicker(props: TodoDatePickerProps) {
  const today = todayBerlinYmd();
  return (
    <Popover open={props.open} anchor={props.anchor} onClose={props.onClose}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Fällig am
      </p>
      <div className="grid grid-cols-2 gap-2">
        {PRESETS.map((item) => (
          <Button
            key={item.preset}
            variant="outline"
            size="sm"
            onClick={() => props.onPick(reschedulePresetDate(item.preset, today))}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div className="mt-3">
        <Input
          type="date"
          aria-label="Datum wählen"
          value={props.due ?? ""}
          onChange={(e) => props.onPick(e.target.value === "" ? null : e.target.value)}
        />
      </div>
      {props.due !== null ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full"
          onClick={() => props.onPick(null)}
        >
          Fälligkeit entfernen
        </Button>
      ) : null}
    </Popover>
  );
}
