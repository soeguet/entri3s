import { CheckCheck, ExternalLink, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "../../components/ui/button";

interface TicketDetailToolbarProps {
  webUrl: string | null;
  markReadPending: boolean;
  syncPending: boolean;
  onMarkRead: () => void;
  onSync: () => void;
}

/** Aktions-Toolbar der Ticket-Detailseite mit konsistenten Button-Styles. */
export function TicketDetailToolbar(props: TicketDetailToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={props.markReadPending}
        onClick={props.onMarkRead}
      >
        <CheckCheck className="h-4 w-4" />
        Als gelesen markieren
      </Button>
      <Button variant="outline" size="sm" disabled={props.syncPending} onClick={props.onSync}>
        <RefreshCw className={"h-4 w-4 " + (props.syncPending ? "animate-spin" : "")} />
        Kommentare aktualisieren
      </Button>
      {props.webUrl ? (
        <a
          href={props.webUrl}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ExternalLink className="h-4 w-4" />
          In GitLab öffnen
        </a>
      ) : null}
    </div>
  );
}
