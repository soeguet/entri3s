import type { Ticket } from "../../../../../shared/types";
import { formatDate } from "../../lib/dates";
import { labelTextColor } from "../../lib/labelColor";
import { AssigneeCell } from "./AssigneeCell";

/** Ein Label/Wert-Paar der Metadaten-Liste (Wert nur rendern, wenn vorhanden). */
function MetaRow(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {props.label}
      </span>
      <div className="min-w-0 text-sm">{props.children}</div>
    </div>
  );
}

const STATE_LABEL: Record<Ticket["state"], string> = {
  opened: "Offen",
  closed: "Geschlossen",
  locked: "Gesperrt",
};

/** Kompaktes Metadaten-Panel eines Tickets (read-only, aus GitLab gesynct). */
export function TicketMeta(props: { ticket: Ticket }) {
  const t = props.ticket;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <MetaRow label="Status">
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
      </MetaRow>

      {t.labels.length > 0 ? (
        <MetaRow label="Labels">
          <div className="flex flex-wrap gap-1">
            {t.labels.map((l) => (
              <span
                key={l.title}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: l.color, color: labelTextColor(l.color) }}
              >
                {l.title}
              </span>
            ))}
          </div>
        </MetaRow>
      ) : null}

      <MetaRow label="Zugewiesen">
        <AssigneeCell assignees={t.assignees} />
      </MetaRow>

      {t.author ? <MetaRow label="Autor">{t.author.name}</MetaRow> : null}
      {t.milestoneTitle ? <MetaRow label="Milestone">{t.milestoneTitle}</MetaRow> : null}
      {t.dueDate ? <MetaRow label="Fällig">{formatDate(t.dueDate)}</MetaRow> : null}
      {t.issueCreatedAt ? <MetaRow label="Erstellt">{formatDate(t.issueCreatedAt)}</MetaRow> : null}
    </div>
  );
}
