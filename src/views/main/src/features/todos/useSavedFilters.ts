import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTodoSavedFilters, setTodoSavedFilters } from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { parseSavedFilters, serializeSavedFilters, type SavedFilter } from "./savedFilters";

// Verwaltung der gespeicherten Filter. Persistiert die GESAMTE Liste als opaken
// JSON-String (eine Mutation deckt add/remove ab). Nach Erfolg wird die Query
// invalidiert; Saved Filters hängen NICHT an todosChanged.
export function useSavedFilters(): {
  filters: SavedFilter[];
  addFilter: (sf: SavedFilter) => void;
  removeFilter: (id: string) => void;
} {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: keys.todoSavedFilters(),
    queryFn: async () => parseSavedFilters(unwrap(await getTodoSavedFilters())),
  });
  const filters = query.data ?? [];

  const save = useMutation({
    mutationFn: async (list: SavedFilter[]) =>
      unwrap(await setTodoSavedFilters(serializeSavedFilters(list))),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.todoSavedFilters() }),
    meta: { silentError: true },
  });

  return {
    filters,
    addFilter: (sf) => save.mutate([...filters, sf]),
    removeFilter: (id) => save.mutate(filters.filter((f) => f.id !== id)),
  };
}
