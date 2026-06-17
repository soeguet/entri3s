import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EntryStatus, Tag } from "../../../../../shared/types";
import { getTags } from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import type { FilterTreeNode } from "../../lib/filterTree";
import { type RangePreset } from "../../lib/dates";
import { Button } from "../../components/ui/button";
import { Select } from "../../components/ui/select";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { EntryFilterTree } from "./EntryFilterTree";

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "today", label: "Heute" },
  { key: "thisWeek", label: "Diese Woche" },
  { key: "lastWeek", label: "Letzte Woche" },
  { key: "thisMonth", label: "Dieser Monat" },
  { key: "lastMonth", label: "Letzter Monat" },
];

interface EntriesFiltersProps {
  status: EntryStatus | "";
  onStatus: (value: EntryStatus | "") => void;
  from: string;
  to: string;
  activePreset: RangePreset | null;
  onPreset: (preset: RangePreset) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onClearRange: () => void;
  selectedTagIds: number[];
  onToggleTag: (id: number) => void;
  tree: FilterTreeNode[];
  selectedNodes: Set<string>;
  onNodes: (next: Set<string>) => void;
}

function tagChipStyle(tag: Tag, active: boolean): CSSProperties {
  if (!active || !tag.color) return {};
  return { backgroundColor: tag.color, borderColor: tag.color, color: "#fff" };
}

export function EntriesFilters(props: EntriesFiltersProps) {
  const tags = useQuery({ queryKey: keys.tags(), queryFn: async () => unwrap(await getTags()) });

  return (
    <aside className="w-72 shrink-0 space-y-4">
      <div>
        <Label htmlFor="f-status">Status</Label>
        <Select
          id="f-status"
          value={props.status}
          onChange={(e) => props.onStatus(e.target.value as EntryStatus | "")}
        >
          <option value="">Alle</option>
          <option value="draft">Entwurf</option>
          <option value="pending_booking">Buchung läuft</option>
          <option value="booked">Gebucht</option>
          <option value="booking_failed">Buchung fehlgeschlagen</option>
          <option value="orphaned">Verwaist</option>
        </Select>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">Zeitraum</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.key}
              size="sm"
              variant={props.activePreset === preset.key ? "default" : "outline"}
              onClick={() => props.onPreset(preset.key)}
            >
              {preset.label}
            </Button>
          ))}
          {props.from || props.to ? (
            <Button size="sm" variant="ghost" onClick={props.onClearRange}>
              Zurücksetzen
            </Button>
          ) : null}
        </div>
        <div className="mt-2 flex gap-2">
          <div className="flex-1">
            <Label htmlFor="f-from">Von</Label>
            <Input
              id="f-from"
              type="date"
              value={props.from}
              onChange={(e) => props.onFrom(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="f-to">Bis</Label>
            <Input
              id="f-to"
              type="date"
              value={props.to}
              onChange={(e) => props.onTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">Tags</p>
        <div className="flex flex-wrap gap-2">
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

      <div>
        <p className="mb-1 text-sm font-medium">Projekte & Tickets</p>
        <EntryFilterTree
          nodes={props.tree}
          selected={props.selectedNodes}
          onChange={props.onNodes}
        />
      </div>
    </aside>
  );
}
