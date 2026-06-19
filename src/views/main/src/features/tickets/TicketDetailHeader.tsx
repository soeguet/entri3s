import type { Ticket } from "../../../../../shared/types";
import { PinButton } from "./PinButton";

const STATE_LABEL: Record<Ticket["state"], string> = {
  opened: "Offen",
  closed: "Geschlossen",
  locked: "Gesperrt",
};

interface TicketDetailHeaderProps {
  ticket: Ticket;
  pinPending: boolean;
  onTogglePin: () => void;
}

/** Kopf der Detailseite: #iid, Titel, Status-Badge und Pin. */
export function TicketDetailHeader(props: TicketDetailHeaderProps) {
  const t = props.ticket;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">#{t.gitlabIid}</span>
          <span
            className={
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium " +
              (t.state === "opened"
                ? "bg-success-surface text-success-accent"
                : "bg-muted text-muted-foreground")
            }
          >
            {STATE_LABEL[t.state]}
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
      </div>
      <PinButton pinned={t.pinned} disabled={props.pinPending} onToggle={props.onTogglePin} />
    </div>
  );
}
