import type { UseFormReturn } from "react-hook-form";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import {
  previewDurationMinutes,
  roundedNowHHmm,
  shiftHHmm,
  type EntryFormValues,
} from "./entrySchema";
import { formatDuration, roundUpToQuarterHour } from "../../lib/dates";

interface EntryDateTimeFieldsProps {
  form: UseFormReturn<EntryFormValues>;
}

export function EntryDateTimeFields(props: EntryDateTimeFieldsProps) {
  const previewMinutes = previewDurationMinutes(
    props.form.watch("startTime"),
    props.form.watch("endTime"),
  );

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="date">Datum</Label>
          <Input id="date" type="date" {...props.form.register("date")} />
        </div>
        <div>
          <Label htmlFor="startTime">Start</Label>
          <Input id="startTime" type="time" {...props.form.register("startTime")} />
          <TimeSteppers form={props.form} field="startTime" />
        </div>
        <div>
          <Label htmlFor="endTime">Ende</Label>
          <Input id="endTime" type="time" {...props.form.register("endTime")} />
          <TimeSteppers form={props.form} field="endTime" />
        </div>
      </div>
      <FieldError message={props.form.formState.errors.endTime?.message} />
      <FieldError message={props.form.formState.errors.startTime?.message} />

      <p className="text-sm text-muted-foreground">
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
    </>
  );
}

function FieldError(props: { message?: string }) {
  if (!props.message) return null;
  return <p className="mt-1 text-xs text-danger-accent">{props.message}</p>;
}

/** Kompakte Button-Gruppe: Jetzt / -15 / +15 unter dem time-Input. */
function TimeSteppers(props: {
  form: UseFormReturn<EntryFormValues>;
  field: "startTime" | "endTime";
}) {
  // Bei ungültigem Wert auf gerundete Jetzt-Zeit zurückfallen
  const cur = () => {
    const v = props.form.getValues(props.field);
    return /^\d{2}:\d{2}$/.test(v) ? v : roundedNowHHmm();
  };
  const set = (val: string) => props.form.setValue(props.field, val);

  return (
    <div className="mt-1 flex gap-1">
      <Button type="button" variant="ghost" size="sm" onClick={() => set(roundedNowHHmm())}>
        Jetzt
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => set(shiftHHmm(cur(), -15))}>
        -15
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => set(shiftHHmm(cur(), +15))}>
        +15
      </Button>
    </div>
  );
}
