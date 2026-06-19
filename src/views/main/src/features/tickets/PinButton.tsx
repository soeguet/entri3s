import { Pin, PinOff } from "lucide-react";

interface PinButtonProps {
  pinned: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function PinButton(props: PinButtonProps) {
  const Icon = props.pinned ? PinOff : Pin;
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onToggle}
      aria-label={props.pinned ? "Pin entfernen" : "Anpinnen"}
      title={props.pinned ? "Pin entfernen" : "Anpinnen"}
      className={
        "inline-flex h-7 w-7 items-center justify-center rounded hover:bg-muted disabled:opacity-50 " +
        (props.pinned ? "text-primary" : "text-muted-foreground hover:text-foreground")
      }
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
