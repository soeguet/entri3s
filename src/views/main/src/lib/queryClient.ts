import { QueryClient, MutationCache, QueryCache } from "@tanstack/react-query";
import { errorMessage } from "./errors";
import { toast } from "./toast";

// Zentrales Feedback: Fehler-Toasts aus den Caches heraus (gilt für ALLE
// Mutationen/Queries), Erfolgs-Toasts pro Mutation via meta.successToast.
// Opt-out für Fehler, die schon inline angezeigt werden: meta.silentError.
export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (err, _vars, _ctx, mutation) => {
      if (mutation.meta?.silentError === true) return;
      toast.error(errorMessage(err));
    },
    onSuccess: (_data, _vars, _ctx, mutation) => {
      const msg = mutation.meta?.successToast;
      if (typeof msg === "string") toast.success(msg);
    },
  }),
  queryCache: new QueryCache({
    onError: (err) => {
      toast.error(errorMessage(err));
    },
  }),
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});
