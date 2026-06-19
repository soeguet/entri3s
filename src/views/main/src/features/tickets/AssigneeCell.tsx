import type { TicketAssignee } from "../../../../../shared/types";

/** Initialen aus dem Anzeigenamen (max. 2 Zeichen) für das Assignee-Badge. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/** Zeigt die Assignees eines Tickets als Initialen-Chips mit Namen im Tooltip. */
export function AssigneeCell(props: { assignees: TicketAssignee[] }) {
  if (props.assignees.length === 0) {
    return <span className="text-muted-foreground">–</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {props.assignees.map((a) => (
        <span
          key={a.gitlabUserId}
          title={`${a.name} (@${a.username})`}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground"
        >
          {initials(a.name)}
        </span>
      ))}
    </div>
  );
}
