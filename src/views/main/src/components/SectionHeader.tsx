import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface SectionHeaderProps {
  children: ReactNode;
  className?: string;
}

export function SectionHeader(props: SectionHeaderProps) {
  return (
    <p
      className={cn(
        "sticky top-0 z-10 border-b border-border bg-muted px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
        props.className,
      )}
    >
      {props.children}
    </p>
  );
}
