import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-muted text-foreground",
        outline: "border border-input text-foreground",
        destructive: "bg-danger-surface text-danger-accent",
        success: "bg-success-surface text-success-accent",
        warning: "bg-warning-surface text-warning-accent",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge(props: BadgeProps) {
  const { variant, className, ...rest } = props;
  return <span className={cn(badgeVariants({ variant }), className)} {...rest} />;
}
