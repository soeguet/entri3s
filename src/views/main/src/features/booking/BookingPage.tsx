import { PageHeader } from "../../components/PageHeader";
import { BookingStatus } from "./BookingStatus";

export function BookingPage() {
  return (
    <div>
      <PageHeader title="Buchungen" description="Fehlgeschlagene Buchungen erneut anstoßen" />
      <BookingStatus />
    </div>
  );
}
