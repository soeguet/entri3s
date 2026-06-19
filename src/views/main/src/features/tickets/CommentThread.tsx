import type { TicketComment } from "../../../../../shared/types";
import { CommentItem } from "./CommentItem";
import { groupByDiscussion } from "./groupByDiscussion";

interface CommentThreadProps {
  comments: TicketComment[];
  lastViewedAt: string | null;
}

function isNew(comment: TicketComment, lastViewedAt: string | null): boolean {
  return lastViewedAt != null && comment.createdAt > lastViewedAt;
}

/**
 * Kommentar-Liste, nach Discussion gruppiert: die erste Note einer Discussion ist
 * Top-Level, weitere Notes werden eingerückt als Antworten darauf dargestellt.
 * Markiert neue Kommentare (seit lastViewedAt) je Note.
 */
export function CommentThread(props: CommentThreadProps) {
  if (props.comments.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Kommentare.</p>;
  }

  const discussions = groupByDiscussion(props.comments);

  return (
    <div className="flex flex-col gap-3">
      {discussions.map((discussion) => (
        <div key={discussion.discussionId} className="flex flex-col gap-2">
          {discussion.notes.map((note, index) => (
            <CommentItem
              key={note.id}
              comment={note}
              isNew={isNew(note, props.lastViewedAt)}
              isReply={index > 0}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
