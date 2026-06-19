import type { TicketComment } from "../../../../../shared/types";
import { CommentItem } from "./CommentItem";

interface CommentThreadProps {
  comments: TicketComment[];
  lastViewedAt: string | null;
}

/** Kommentar-Liste, chronologisch aufsteigend; markiert neue (seit lastViewedAt). */
export function CommentThread(props: CommentThreadProps) {
  if (props.comments.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Kommentare.</p>;
  }

  // Kopie sortieren — die Prop-Array nie mutieren.
  const sorted = [...props.comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          isNew={props.lastViewedAt != null && comment.createdAt > props.lastViewedAt}
        />
      ))}
    </div>
  );
}
