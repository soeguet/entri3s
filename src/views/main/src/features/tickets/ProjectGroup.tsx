import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import type { Ticket } from "../../../../../shared/types";
import { formatDuration } from "../../lib/dates";
import { Badge } from "../../components/ui/badge";
import { TR, TD } from "../../components/ui/table";
import { AssigneeCell } from "./AssigneeCell";
import { PinButton } from "./PinButton";

export interface Group {
  path: string;
  name: string;
  tickets: Ticket[];
}

function seconds(s: number | null): string {
  return s == null ? "–" : formatDuration(Math.round(s / 60));
}

export function ProjectGroup(props: {
  group: Group;
  pinPending: boolean;
  onTogglePin: (ticket: Ticket) => void;
  onOpen: (ticket: Ticket) => void;
}) {
  return (
    <>
      <TR className="bg-muted">
        <TD colSpan={9} className="py-1.5">
          <span className="font-medium text-foreground">{props.group.name}</span>
          <span className="ml-2 font-mono text-xs text-muted-foreground">{props.group.path}</span>
        </TD>
      </TR>
      {props.group.tickets.map((ticket) => (
        <TR
          key={ticket.id}
          // Ganze Zeile klickbar: navigiert zum Ticket-Detail. Interaktive Kinder
          // (Pin, GitLab-Link) schirmen sich per stopPropagation selbst ab.
          onClick={() => props.onOpen(ticket)}
          className={
            "cursor-pointer hover:bg-muted" + (ticket.status === "orphaned" ? " opacity-50" : "")
          }
        >
          <TD className="font-mono">
            {ticket.unread ? (
              <span
                className="mr-1.5 inline-block h-2 w-2 rounded-full bg-info-accent align-middle"
                aria-label="Ungelesen"
                title="Ungelesen"
              />
            ) : null}
            <Link
              to="/tickets/$ticketId"
              params={{ ticketId: String(ticket.id) }}
              className="text-info-accent hover:underline"
            >
              #{ticket.gitlabIid}
            </Link>
          </TD>
          <TD>
            <Link
              to="/tickets/$ticketId"
              params={{ ticketId: String(ticket.id) }}
              className="hover:underline"
            >
              {ticket.title}
            </Link>
          </TD>
          <TD>
            {ticket.status === "orphaned" ? (
              <Badge variant="destructive">Archiviert</Badge>
            ) : (
              <Badge variant="success">Aktiv</Badge>
            )}
          </TD>
          <TD>{ticket.state}</TD>
          <TD>
            <AssigneeCell assignees={ticket.assignees} />
          </TD>
          <TD>{seconds(ticket.timeEstimate)}</TD>
          <TD>{seconds(ticket.timeSpent)}</TD>
          <TD onClick={(e) => e.stopPropagation()}>
            <PinButton
              pinned={ticket.pinned}
              disabled={props.pinPending}
              onToggle={() => props.onTogglePin(ticket)}
            />
          </TD>
          <TD>
            {ticket.webUrl ? (
              <a
                href={ticket.webUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </TD>
        </TR>
      ))}
    </>
  );
}
