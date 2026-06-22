import type { Entry, Tag, Ticket } from "../../../../../shared/types";
import { formatWeekday, formatDate, formatTime, formatEndTime } from "../../lib/dates";
import { cn } from "../../lib/utils";
import { Tooltip } from "../../components/ui/tooltip";
import type { QuickEditField } from "./EntryQuickEditDialog";

const cellBtn = "cursor-pointer rounded px-1 text-left hover:bg-muted";

interface DateCellProps {
  entry: Entry;
  onQuickEdit: (entry: Entry, field: QuickEditField, anchor: HTMLElement) => void;
}

/** Datums-/Zeit-Zelle als Klick-Trigger fürs Datums-Quick-Edit. */
export function DateCell(props: DateCellProps) {
  const d = props.entry.date;
  return (
    <button
      type="button"
      aria-label="Datum bearbeiten"
      onClick={(e) => props.onQuickEdit(props.entry, "date", e.currentTarget)}
      className={cn(cellBtn, "whitespace-nowrap")}
    >
      {formatWeekday(d)}, {formatDate(d)} · {formatTime(d)} -{" "}
      {formatEndTime(d, props.entry.durationMinutes)}
    </button>
  );
}

interface NotesCellProps {
  entry: Entry;
  onQuickEdit: (entry: Entry, field: QuickEditField, anchor: HTMLElement) => void;
}

/** Notiz-Zelle als Klick-Trigger fürs Notiz-Quick-Edit. */
export function NotesCell(props: NotesCellProps) {
  return (
    <button
      type="button"
      aria-label="Notiz bearbeiten"
      onClick={(e) => props.onQuickEdit(props.entry, "notes", e.currentTarget)}
      className={cellBtn}
    >
      {props.entry.notes ?? <span className="text-muted-foreground">–</span>}
    </button>
  );
}

interface TicketCellProps {
  entry: Entry;
  ticketsById: Map<number, Ticket>;
  onQuickEdit: (entry: Entry, field: QuickEditField, anchor: HTMLElement) => void;
}

/** Ticket-Zelle als Klick-Trigger fürs Ticket-Quick-Edit. */
export function TicketCell(props: TicketCellProps) {
  const tickets = props.entry.ticketIds
    .map((id) => props.ticketsById.get(id))
    .filter((t): t is Ticket => Boolean(t));
  const iids = tickets.map((t) => `#${t.gitlabIid}`);

  const button = (
    <button
      type="button"
      aria-label="Ticket bearbeiten"
      onClick={(e) => props.onQuickEdit(props.entry, "ticket", e.currentTarget)}
      className={cellBtn}
    >
      {iids.length > 0 ? iids.join(", ") : <span className="text-muted-foreground">–</span>}
    </button>
  );

  if (tickets.length === 0) return button;

  return (
    <Tooltip
      content={tickets.map((t) => (
        <div key={t.id}>
          #{t.gitlabIid} {t.title}
        </div>
      ))}
    >
      {button}
    </Tooltip>
  );
}

interface TagsCellProps {
  entry: Entry;
  tagsById: Map<number, Tag>;
  onQuickEdit: (entry: Entry, field: QuickEditField, anchor: HTMLElement) => void;
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
      onClick={(e) => props.onQuickEdit(props.entry, "tags", e.currentTarget)}
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
