// Modul-globaler Toast-Store. Lebt absichtlich AUSSERHALB von React, damit auch
// Nicht-Komponenten-Code (queryClient.ts, api/real.ts) toasten kann. React liest
// ihn via useSyncExternalStore (siehe components/ui/toaster.tsx).

export type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: number;
  variant: ToastVariant;
  message: string;
}

const AUTO_DISMISS_MS = 4000;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit() {
  // Neue Referenz, damit useSyncExternalStore die Änderung erkennt.
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): Toast[] {
  return toasts;
}

function push(variant: ToastVariant, message: string): number {
  const id = nextId++;
  toasts = [...toasts, { id, variant, message }];
  timers.set(
    id,
    setTimeout(() => dismissToast(id), AUTO_DISMISS_MS),
  );
  emit();
  return id;
}

export function dismissToast(id: number) {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  const next = toasts.filter((t) => t.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
  info: (message: string) => push("info", message),
};

/** Nur für Tests: setzt den Store hart zurück. */
export function resetToasts() {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  toasts = [];
  nextId = 1;
  emit();
}
