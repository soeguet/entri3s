import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Filter,
  FolderTree,
  History,
  List,
  PanelLeftOpen,
  Pencil,
  Sun,
  Sunset,
  Tags,
} from "lucide-react";
import type { EntryStatus } from "../../../../../shared/types";
import { getTags } from "../../api";
import type { RangePreset } from "../../lib/dates";
import { unwrap } from "../../lib/errors";
import { keys } from "../../lib/queryKeys";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Separator } from "../../components/ui/separator";
import { PRESETS, type FilterControls } from "./EntriesFilters";

interface EntriesFiltersCompactProps extends FilterControls {
  from: string;
  to: string;
  onClearRange: () => void;
  selectedNodes: Set<string>;
  onClearNodes: () => void;
  onExpand: () => void;
}

const PRESET_ICONS: Record<RangePreset, LucideIcon> = {
  today: Sun,
  yesterday: Sunset,
  thisWeek: CalendarRange,
  lastWeek: CalendarClock,
  thisMonth: CalendarDays,
  lastMonth: History,
};

const STATUS_CHIPS: { value: EntryStatus | ""; label: string; Icon: LucideIcon }[] = [
  { value: "", label: "Alle", Icon: List },
  { value: "draft", label: "Entwurf", Icon: Pencil },
  { value: "booked", label: "Gebucht", Icon: CheckCircle2 },
];

const STATUS_LABELS: Record<string, string> = {
  pending_booking: "Buchung läuft",
  booking_failed: "Buchung fehlgeschlagen",
  orphaned: "Verwaist",
  running: "Läuft",
};

export function EntriesFiltersCompact(props: EntriesFiltersCompactProps) {
  const tags = useQuery({ queryKey: keys.tags(), queryFn: async () => unwrap(await getTags()) });

  const count = props.selectedTagIds.length;
  const activeTags = (tags.data ?? []).filter((t) => props.selectedTagIds.includes(t.id));

  const showHiddenStatus =
    props.status !== "" && props.status !== "draft" && props.status !== "booked";
  const showCustomRange = (props.from !== "" || props.to !== "") && props.activePreset === null;
  const showNodes = props.selectedNodes.size > 0;
  const showActive = showHiddenStatus || showCustomRange || showNodes;

  return (
    <aside id="entries-filters" className="w-14 shrink-0 space-y-3">
      <div className="flex justify-center">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Filter ausklappen"
          aria-expanded={false}
          aria-controls="entries-filters"
          onClick={props.onExpand}
        >
          <PanelLeftOpen className="h-4 w-4" />
          <span className="sr-only">Filter</span>
        </Button>
      </div>

      <Separator />

      <div className="flex flex-col items-center gap-1.5">
        {PRESETS.map((preset) => {
          const Icon = PRESET_ICONS[preset.key];
          return (
            <Button
              key={preset.key}
              variant={props.activePreset === preset.key ? "default" : "outline"}
              size="icon"
              title={preset.label}
              aria-label={preset.label}
              onClick={() => props.onPreset(preset.key)}
            >
              <Icon className="h-4 w-4" />
            </Button>
          );
        })}
      </div>

      <Separator />

      <div className="flex flex-col items-center gap-1.5">
        {STATUS_CHIPS.map((chip) => (
          <Button
            key={chip.value || "all"}
            variant={props.status === chip.value ? "default" : "outline"}
            size="icon"
            title={chip.label}
            aria-label={chip.label}
            onClick={() => props.onStatus(chip.value)}
          >
            <chip.Icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      <Separator />

      <div className="flex flex-col items-center gap-1.5">
        <div className="relative">
          <Button
            variant="outline"
            size="icon"
            title="Tags auswählen (aufklappen)"
            aria-label="Tags auswählen (aufklappen)"
            onClick={props.onExpand}
          >
            <Tags className="h-4 w-4" />
          </Button>
          {count > 0 ? (
            <Badge className="absolute -right-1 -top-1 h-4 min-w-4 justify-center px-1 text-[10px]">
              {count}
            </Badge>
          ) : null}
        </div>
        {activeTags.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-1">
            {activeTags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                title={tag.name}
                className="h-2.5 w-2.5 rounded-full border"
                style={{ backgroundColor: tag.color ?? undefined }}
              />
            ))}
            {activeTags.length > 3 ? (
              <span className="text-[10px] text-muted-foreground">+{activeTags.length - 3}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      {showActive ? (
        <>
          <Separator />
          <div className="flex flex-col items-center gap-1.5">
            {showHiddenStatus ? (
              <Button
                variant="ghost"
                size="icon"
                className="ring-1 ring-primary text-primary"
                title={`Status: ${STATUS_LABELS[props.status] ?? props.status} — entfernen`}
                aria-label={`Status: ${STATUS_LABELS[props.status] ?? props.status} — entfernen`}
                onClick={() => props.onStatus("")}
              >
                <Filter className="h-4 w-4" />
              </Button>
            ) : null}
            {showCustomRange ? (
              <Button
                variant="ghost"
                size="icon"
                className="ring-1 ring-primary text-primary"
                title="Eigener Zeitraum — entfernen"
                aria-label="Eigener Zeitraum — entfernen"
                onClick={props.onClearRange}
              >
                <CalendarClock className="h-4 w-4" />
              </Button>
            ) : null}
            {showNodes ? (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="ring-1 ring-primary text-primary"
                  title={`Projekte/Tickets (${props.selectedNodes.size}) — entfernen`}
                  aria-label={`Projekte/Tickets (${props.selectedNodes.size}) — entfernen`}
                  onClick={props.onClearNodes}
                >
                  <FolderTree className="h-4 w-4" />
                </Button>
                <Badge className="absolute -right-1 -top-1 h-4 min-w-4 justify-center px-1 text-[10px]">
                  {props.selectedNodes.size}
                </Badge>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </aside>
  );
}
