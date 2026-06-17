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
        destructive: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
        success: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
        warning: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
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
