import type { Ticket } from "../../../../../shared/types";
import { formatDate } from "../../lib/dates";
import { renderGitlabHtml } from "../../lib/gitlabHtml";
import { AssigneeCell } from "./AssigneeCell";

/** Ein Label/Wert-Paar der Metadaten-Liste (Wert nur rendern, wenn vorhanden). */
function MetaRow(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-28 shrink-0 text-muted-foreground">{props.label}</span>
      <div className="min-w-0">{props.children}</div>
    </div>
  );
}

const STATE_LABEL: Record<Ticket["state"], string> = {
  opened: "Offen",
  closed: "Geschlossen",
  locked: "Gesperrt",
};

/** Kopf-Metadaten + Beschreibung eines Tickets (read-only, aus GitLab gesynct). */
export function TicketMeta(props: { ticket: Ticket }) {
  const t = props.ticket;

  return (
    <div className="mb-6 space-y-4">
      <div className="space-y-2 rounded border border-border bg-card p-4">
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
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: l.color }}
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
        {t.issueCreatedAt ? (
          <MetaRow label="Erstellt">{formatDate(t.issueCreatedAt)}</MetaRow>
        ) : null}
      </div>

      {t.descriptionHtml ? (
        // Bewusst KEIN Sanitizing — lokale Single-User-App, HTML kommt vom eigenen
        // GitLab (gleiches Muster wie CommentItem).
        <div
          className="gitlab-content"
          dangerouslySetInnerHTML={{ __html: renderGitlabHtml(t.descriptionHtml) }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Keine Beschreibung.</p>
      )}
    </div>
  );
}
