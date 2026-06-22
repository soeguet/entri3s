import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { shiftDay, singleDayBase, todayBerlinYmd } from "../../lib/dates";

interface DayNavigatorProps {
  from: string;
  to: string;
  onDay: (day: string) => void;
}

export function DayNavigator(props: DayNavigatorProps) {
  const currentDay = props.from && props.from === props.to ? props.from : "";

  return (
    <div className="mb-3 flex items-center gap-1">
      <Button
        size="icon"
        variant="outline"
        aria-label="Tag zurück"
        title="Vorheriger Tag (,)"
        onClick={() => {
          props.onDay(shiftDay(singleDayBase(props.from, props.to, todayBerlinYmd()), -1));
        }}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Input
        type="date"
        className="w-40"
        value={currentDay}
        onChange={(e) => {
          if (e.target.value) props.onDay(e.target.value);
        }}
      />
      <Button
        size="icon"
        variant="outline"
        aria-label="Tag vor"
        title="Nächster Tag (.)"
        onClick={() => {
          props.onDay(shiftDay(singleDayBase(props.from, props.to, todayBerlinYmd()), +1));
        }}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        title="Heute (t)"
        onClick={() => props.onDay(todayBerlinYmd())}
      >
        Heute
      </Button>
    </div>
  );
}
