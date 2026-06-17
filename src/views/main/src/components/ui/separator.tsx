import { cn } from "../../lib/utils";

export function Separator(props: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", props.className)} />;
}
