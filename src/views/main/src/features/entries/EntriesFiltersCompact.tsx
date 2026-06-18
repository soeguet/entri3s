import { useQuery } from "@tanstack/react-query";
import type { EntryStatus } from "../../../../../shared/types";
import { getTags } from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { Button } from "../../components/ui/button";
import { PanelLeftOpen, X } from "lucide-react";
import { PRESETS, tagChipStyle, type FilterControls } from "./EntriesFilters";

interface EntriesFiltersCompactProps extends FilterControls {
  from: string;
  to: string;
  onClearRange: () => void;
  selectedNodes: Set<string>;
  onClearNodes: () => void;
  onExpand: () => void;
}

const STATUS_CHIPS: { value: EntryStatus | ""; label: string }[] = [
  { value: "", label: "Alle" },
  { value: "draft", label: "Entwurf" },
  { value: "booked", label: "Gebucht" },
];

const STATUS_LABELS: Record<string, string> = {
  pending_booking: "Buchung läuft",
  booking_failed: "Buchung fehlgeschlagen",
  orphaned: "Verwaist",
  running: "Läuft",
};

export function EntriesFiltersCompact(props: EntriesFiltersCompactProps) {
  const tags = useQuery({ queryKey: keys.tags(), queryFn: async () => unwrap(await getTags()) });

  const showHiddenStatus =
    props.status !== "" && props.status !== "draft" && props.status !== "booked";
  const showCustomRange = (props.from !== "" || props.to !== "") && props.activePreset === null;
  const showNodes = props.selectedNodes.size > 0;
  const showActive = showHiddenStatus || showCustomRange || showNodes;

  return (
    <aside id="entries-filters" className="w-12 shrink-0 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Filter</p>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Filter ausklappen"
          aria-expanded={false}
          aria-controls="entries-filters"
          onClick={props.onExpand}
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">Zeitraum</p>
        <div className="flex flex-col gap-1.5">
          {PRESETS.map((preset) => (
            <Button
              key={preset.key}
              size="sm"
              variant={props.activePreset === preset.key ? "default" : "outline"}
              onClick={() => props.onPreset(preset.key)}
              className="text-[10px]"
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">Status</p>
        <div className="flex flex-col gap-1.5">
          {STATUS_CHIPS.map((chip) => (
            <Button
              key={chip.value || "all"}
              size="sm"
              variant={props.status === chip.value ? "default" : "outline"}
              onClick={() => props.onStatus(chip.value)}
              className="text-[10px]"
            >
              {chip.label}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">Tags</p>
        <div className="flex flex-col gap-1.5">
          {(tags.data ?? []).map((tag) => {
            const active = props.selectedTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => props.onToggleTag(tag.id)}
                style={tagChipStyle(tag, active)}
                className={
                  "rounded-full border px-3 py-1 text-xs font-medium " +
                  (active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input text-muted-foreground")
                }
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      </div>

      {showActive ? (
        <div className="flex flex-col gap-1.5">
          {showHiddenStatus ? (
            <button
              type="button"
              aria-label="Statusfilter entfernen"
              onClick={() => props.onStatus("")}
              className="inline-flex items-center gap-1 rounded-full border border-input px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
            >
              {STATUS_LABELS[props.status] ?? props.status}
              <X className="h-3 w-3" />
            </button>
          ) : null}
          {showCustomRange ? (
            <button
              type="button"
              aria-label="Zeitraumfilter entfernen"
              onClick={props.onClearRange}
              className="inline-flex items-center gap-1 rounded-full border border-input px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
            >
              Eigener Zeitraum
              <X className="h-3 w-3" />
            </button>
          ) : null}
          {showNodes ? (
            <button
              type="button"
              aria-label="Projekt-/Ticketfilter entfernen"
              onClick={props.onClearNodes}
              className="inline-flex items-center gap-1 rounded-full border border-input px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
            >
              {`Projekte/Tickets (${props.selectedNodes.size})`}
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
