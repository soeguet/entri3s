import type { TicketComment } from "../../../../../shared/types";
import { formatDateTime } from "../../lib/dates";
import { renderGitlabHtml } from "../../lib/gitlabHtml";
import { Badge } from "../../components/ui/badge";

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
    ? "rounded border border-border bg-card p-3 border-l-4 border-l-info-accent pl-3"
    : "rounded border border-border bg-card p-3";
  // Replies bekommen eine linke Einrückung + dezenten Rand als Connector, damit
  // klar erkennbar ist: Antwort auf den darüberliegenden Kommentar.
  const wrapper = props.isReply ? `ml-6 border-l-2 border-border pl-3 ${card}` : card;

  return (
    <div className={wrapper}>
      <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-foreground">{props.comment.authorName}</span>
        <span className="text-muted-foreground">@{props.comment.authorUsername}</span>
        <span className="text-muted-foreground">{formatDateTime(props.comment.createdAt)}</span>
        {props.isNew ? <Badge variant="secondary">Neu</Badge> : null}
      </div>
      {/* Bewusst KEIN Sanitizing — lokale Single-User-App, HTML kommt vom eigenen GitLab.
          renderGitlabHtml entpackt <gl-emoji> in den Unicode-Fallback (sonst unsichtbar). */}
      <div
        className="gitlab-content"
        dangerouslySetInnerHTML={{ __html: renderGitlabHtml(props.comment.bodyHtml) }}
      />
    </div>
  );
}
