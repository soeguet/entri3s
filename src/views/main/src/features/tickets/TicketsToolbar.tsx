import { Search } from "lucide-react";
import type { TicketState, TicketStatus } from "../../../../../shared/types";
import { Button } from "../../components/ui/button";
import { Select } from "../../components/ui/select";
import { Label } from "../../components/ui/label";

export function TicketsToolbar(props: {
  search: string;
  setSearch: (value: string) => void;
  status: TicketStatus | "";
  setStatus: (value: TicketStatus | "") => void;
  state: TicketState | "";
  setState: (value: TicketState | "") => void;
  assignedToMe: boolean;
  setAssignedToMe: (value: boolean) => void;
  currentUserAvailable: boolean;
  pinnedOnly: boolean;
  setPinnedOnly: (value: boolean) => void;
  unreadOnly: boolean;
  setUnreadOnly: (value: boolean) => void;
  onMarkAllRead: () => void;
  markAllReadPending: boolean;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1">
        <Label htmlFor="t-search">Suche</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            id="t-search"
            value={props.search}
            onChange={(e) => props.setSearch(e.target.value)}
            placeholder="#IID, Titel oder Projekt…"
            className="h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="t-status">Status</Label>
        <Select
          id="t-status"
          value={props.status}
          onChange={(e) => props.setStatus(e.target.value as TicketStatus | "")}
        >
          <option value="">Alle</option>
          <option value="active">Aktiv</option>
          <option value="orphaned">Archiviert</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="t-state">GitLab-State</Label>
        <Select
          id="t-state"
          value={props.state}
          onChange={(e) => props.setState(e.target.value as TicketState | "")}
        >
          <option value="">Alle</option>
          <option value="opened">opened</option>
          <option value="closed">closed</option>
          <option value="locked">locked</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="t-mine">Zuweisung</Label>
        <Button
          id="t-mine"
          type="button"
          variant={props.assignedToMe ? "default" : "outline"}
          disabled={!props.currentUserAvailable}
          onClick={() => props.setAssignedToMe(!props.assignedToMe)}
        >
          Mir zugewiesen
        </Button>
      </div>
      <div>
        <Label htmlFor="t-pinned">Pins</Label>
        <Button
          id="t-pinned"
          type="button"
          variant={props.pinnedOnly ? "default" : "outline"}
          onClick={() => props.setPinnedOnly(!props.pinnedOnly)}
        >
          Gepinnt
        </Button>
      </div>
      <div>
        <Label htmlFor="t-unread">Ungelesen</Label>
        <Button
          id="t-unread"
          type="button"
          variant={props.unreadOnly ? "default" : "outline"}
          onClick={() => props.setUnreadOnly(!props.unreadOnly)}
        >
          Ungelesen
        </Button>
      </div>
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={props.markAllReadPending}
          onClick={props.onMarkAllRead}
        >
          Alle als gelesen markieren
        </Button>
      </div>
    </div>
  );
}
