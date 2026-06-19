import { useNavigate, useSearch } from "@tanstack/react-router";
import type { TicketsSearch } from "./ticketsSearch";

/**
 * Liest den Tickets-Filter/Such-/Sortier-State aus den URL-Search-Params und
 * stellt einen Updater bereit. Schreiben erfolgt mit `replace: true`, damit nicht
 * jeder Filter-Klick einen History-Eintrag erzeugt (sonst müsste man pro Klick
 * einmal „Zurück" drücken).
 */
export function useTicketsSearch() {
  const search = useSearch({ from: "/tickets" });
  const navigate = useNavigate({ from: "/tickets" });

  function update(patch: Partial<TicketsSearch>) {
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
  }

  function toggleSort(by: TicketsSearch["sortBy"]) {
    if (search.sortBy === by) {
      update({ sortDir: search.sortDir === "asc" ? "desc" : "asc" });
    } else {
      update({ sortBy: by, sortDir: "asc" });
    }
  }

  return { search, update, toggleSort };
}
