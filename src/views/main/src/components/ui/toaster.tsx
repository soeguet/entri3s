import { useSyncExternalStore } from "react";
import { cva } from "class-variance-authority";
import { subscribe, getSnapshot, dismissToast, type Toast } from "../../lib/toast";
import { cn } from "../../lib/utils";

const toastVariants = cva(
  "pointer-events-auto cursor-pointer rounded-md border px-4 py-2.5 text-sm font-medium shadow-md",
  {
    variants: {
      variant: {
        success: "border-success-border bg-success-surface text-success-accent",
        error: "border-danger-border bg-danger-surface text-danger-accent",
        info: "border-border bg-card text-foreground",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

/** Rendert den Toast-Stapel (fixed bottom-right). Einmal im Root mounten. */
export function Toaster() {
  const toasts = useSyncExternalStore(subscribe, getSnapshot);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((item) => (
        <ToastItem key={item.id} toast={item} />
      ))}
    </div>
  );
}

function ToastItem(props: { toast: Toast }) {
  return (
    <div
      role="status"
      onClick={() => dismissToast(props.toast.id)}
      className={cn(toastVariants({ variant: props.toast.variant }))}
    >
      {props.toast.message}
    </div>
  );
}
