import { Popover } from "../../components/ui/popover";
import { Button } from "../../components/ui/button";
import { breadcrumbLabel } from "./listHierarchy";

interface TodoMoveMenuProps {
  open: boolean;
  anchor: HTMLElement | null;
  // Bereits die ZIEL-Listen ohne die aktuelle Liste des Tasks.
  lists: string[];
  onClose: () => void;
  onMove: (toList: string) => void;
}

// Kleines Popover zum Verschieben eines Tasks in eine andere Liste. Reine UI —
// die Mutation triggert der Aufrufer in onMove. Hält TodoRow schlank.
export function TodoMoveMenu(props: TodoMoveMenuProps) {
  return (
    <Popover open={props.open} anchor={props.anchor} onClose={props.onClose}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Verschieben nach
      </p>
      {props.lists.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine andere Liste</p>
      ) : (
        <div className="flex flex-col gap-1">
          {props.lists.map((name) => (
            <Button
              key={name}
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => props.onMove(name)}
            >
              {breadcrumbLabel(name)}
            </Button>
          ))}
        </div>
      )}
    </Popover>
  );
}
