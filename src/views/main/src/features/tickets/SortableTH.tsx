import { ChevronDown, ChevronUp } from "lucide-react";
import { TH } from "../../components/ui/table";
import type { TicketSortBy, TicketSortDir } from "./ticketsSort";

/** Klickbarer Spaltenkopf: setzt/toggelt die Sortierung und zeigt den Indikator. */
export function SortableTH(props: {
  by: TicketSortBy;
  label: string;
  activeBy: TicketSortBy;
  dir: TicketSortDir;
  onSort: (by: TicketSortBy) => void;
}) {
  const active = props.activeBy === props.by;
  return (
    <TH>
      <button
        type="button"
        onClick={() => props.onSort(props.by)}
        className="inline-flex items-center gap-1 uppercase hover:text-foreground"
        aria-sort={active ? (props.dir === "asc" ? "ascending" : "descending") : "none"}
      >
        {props.label}
        {active ? (
          props.dir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )
        ) : null}
      </button>
    </TH>
  );
}
