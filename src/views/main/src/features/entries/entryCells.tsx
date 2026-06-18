import type { Entry, Tag, Ticket } from "../../../../../shared/types";
import { formatWeekday, formatDate, formatTime, formatEndTime } from "../../lib/dates";
import { cn } from "../../lib/utils";
import type { QuickEditField } from "./EntryQuickEditDialog";

const cellBtn = "cursor-pointer rounded px-1 text-left hover:bg-muted";

interface DateCellProps {
  entry: Entry;
  onQuickEdit: (entry: Entry, field: QuickEditField) => void;
}

/** Datums-/Zeit-Zelle als Klick-Trigger fürs Datums-Quick-Edit. */
export function DateCell(props: DateCellProps) {
  const d = props.entry.date;
  return (
    <button
      type="button"
      aria-label="Datum bearbeiten"
      onClick={() => props.onQuickEdit(props.entry, "date")}
      className={cn(cellBtn, "whitespace-nowrap")}
    >
      {formatWeekday(d)}, {formatDate(d)} · {formatTime(d)} -{" "}
      {formatEndTime(d, props.entry.durationMinutes)}
    </button>
  );
}

interface NotesCellProps {
  entry: Entry;
  onQuickEdit: (entry: Entry, field: QuickEditField) => void;
}

/** Notiz-Zelle als Klick-Trigger fürs Notiz-Quick-Edit. */
export function NotesCell(props: NotesCellProps) {
  return (
    <button
      type="button"
      aria-label="Notiz bearbeiten"
      onClick={() => props.onQuickEdit(props.entry, "notes")}
      className={cellBtn}
    >
      {props.entry.notes ?? <span className="text-muted-foreground">–</span>}
    </button>
  );
}

interface TicketCellProps {
  entry: Entry;
  ticketsById: Map<number, Ticket>;
  onQuickEdit: (entry: Entry, field: QuickEditField) => void;
}

/** Ticket-Zelle als Klick-Trigger fürs Ticket-Quick-Edit. */
export function TicketCell(props: TicketCellProps) {
  const iids = props.entry.ticketIds
    .map((id) => props.ticketsById.get(id))
    .filter((t): t is Ticket => Boolean(t))
    .map((t) => `#${t.gitlabIid}`);
  return (
    <button
      type="button"
      aria-label="Ticket bearbeiten"
      onClick={() => props.onQuickEdit(props.entry, "ticket")}
      className={cellBtn}
    >
      {iids.length > 0 ? iids.join(", ") : <span className="text-muted-foreground">–</span>}
    </button>
  );
}

interface TagsCellProps {
  entry: Entry;
  tagsById: Map<number, Tag>;
  onQuickEdit: (entry: Entry, field: QuickEditField) => void;
}

/** Tags-Zelle (Chips) als Klick-Trigger fürs Tags-Quick-Edit. */
export function TagsCell(props: TagsCellProps) {
  const tags = props.entry.tagIds
    .map((id) => props.tagsById.get(id))
    .filter((t): t is Tag => Boolean(t));
  return (
    <button
      type="button"
      aria-label="Tags bearbeiten"
      onClick={() => props.onQuickEdit(props.entry, "tags")}
      className={cn(cellBtn, "flex flex-wrap gap-1")}
    >
      {tags.length === 0 ? (
        <span className="text-muted-foreground">–</span>
      ) : (
        tags.map((tag) => (
          <span
            key={tag.id}
            style={tag.color ? { backgroundColor: tag.color, color: "#fff" } : undefined}
            className={
              "rounded-full px-2 py-0.5 text-xs font-medium " +
              (tag.color ? "" : "bg-muted text-foreground")
            }
          >
            {tag.name}
          </span>
        ))
      )}
    </button>
  );
}
