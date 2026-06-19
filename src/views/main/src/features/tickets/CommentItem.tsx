import type { TicketComment } from "../../../../../shared/types";
import { formatDateTime } from "../../lib/dates";
import { Badge } from "../../components/ui/badge";
import { GitlabContent } from "./GitlabContent";

interface CommentItemProps {
  comment: TicketComment;
  isNew: boolean;
  // Antwort innerhalb einer Discussion → eingerückt mit linkem Connector dargestellt.
  isReply?: boolean;
}

/** Ein einzelner Kommentar — System-Notizen kompakt, normale als HTML-Karte. */
export function CommentItem(props: CommentItemProps) {
  if (props.comment.isSystem) {
    // System-Notizen bewusst als schlichte Timeline-Zeile (kein HTML-Card).
    return (
      <div className="text-xs text-muted-foreground">
        <span className="font-medium">{props.comment.authorName}</span> {props.comment.body}{" "}
        <span>· {formatDateTime(props.comment.createdAt)}</span>
      </div>
    );
  }

  const card = props.isNew
    ? "rounded-lg border border-border bg-card p-3 border-l-4 border-l-info-accent"
    : "rounded-lg border border-border bg-card p-3";
  // Replies bekommen eine linke Einrückung + dezenten Rand als Connector, damit
  // klar erkennbar ist: Antwort auf den darüberliegenden Kommentar.
  const wrapper = props.isReply ? `ml-6 border-l-2 border-border pl-3 ${card}` : card;

  return (
    <div className={wrapper}>
      <div className="mb-2 flex items-center gap-2 text-sm">
        <span
          title={`${props.comment.authorName} (@${props.comment.authorUsername})`}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground"
        >
          {commentInitials(props.comment.authorName)}
        </span>
        <span className="font-medium text-foreground">{props.comment.authorName}</span>
        <span className="text-muted-foreground">@{props.comment.authorUsername}</span>
        <span className="text-muted-foreground">· {formatDateTime(props.comment.createdAt)}</span>
        {props.isNew ? <Badge variant="secondary">Neu</Badge> : null}
      </div>
      <GitlabContent html={props.comment.bodyHtml} />
    </div>
  );
}

/** Initialen aus dem Anzeigenamen (max. 2 Zeichen) — gleiche Logik wie AssigneeCell. */
function commentInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}
