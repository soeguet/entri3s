import type { Entry } from "../../../../../shared/types";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";

interface EntryActionsDialogProps {
  entry: Entry | null;
  timerRunning: boolean;
  onResume: (entry: Entry) => void;
  onDuplicate: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
  onClose: () => void;
}

/**
 * Modal mit den potenziell gefährlichen Entry-Aktionen (Fortsetzen,
 * Duplizieren, Löschen). Bewusst hinter einen Extra-Schritt gelegt, damit sie
 * nicht versehentlich direkt aus der Tabellenzeile ausgelöst werden.
 */
export function EntryActionsDialog(props: EntryActionsDialogProps) {
  const entry = props.entry;
  if (entry === null) return null;

  const canResume = entry.status === "draft" || entry.status === "booking_failed";
  const label = entry.notes && entry.notes.length > 0 ? entry.notes : `Entry #${entry.id}`;

  return (
    <Dialog open={entry !== null} onClose={props.onClose} title="Aktionen">
      <p className="mb-4 text-sm text-muted-foreground">{label}</p>
      <div className="flex flex-col gap-2">
        {canResume ? (
          <Button
            variant="outline"
            disabled={props.timerRunning}
            title={props.timerRunning ? "Es läuft bereits ein Timer — zuerst stoppen" : undefined}
            onClick={() => {
              props.onResume(entry);
              props.onClose();
            }}
          >
            Fortsetzen
          </Button>
        ) : null}
        <Button
          variant="outline"
          onClick={() => {
            props.onDuplicate(entry);
            props.onClose();
          }}
        >
          Duplizieren
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            props.onDelete(entry);
            props.onClose();
          }}
        >
          Löschen
        </Button>
      </div>
    </Dialog>
  );
}
