import type { EntryStatus } from "../../../../../shared/types";
import { Badge } from "../../components/ui/badge";

const LABELS: Record<EntryStatus, string> = {
  draft: "Entwurf",
  pending_booking: "Buchung läuft",
  booked: "Gebucht",
  booking_failed: "Buchung fehlgeschlagen",
  orphaned: "Verwaist",
};

const VARIANTS: Record<EntryStatus, "secondary" | "warning" | "success" | "destructive"> = {
  draft: "secondary",
  pending_booking: "warning",
  booked: "success",
  booking_failed: "destructive",
  orphaned: "destructive",
};

export function EntryStatusBadge(props: { status: EntryStatus }) {
  return <Badge variant={VARIANTS[props.status]}>{LABELS[props.status]}</Badge>;
}
