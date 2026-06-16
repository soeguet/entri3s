import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-slate-900 text-slate-50",
        secondary: "bg-slate-100 text-slate-700",
        outline: "border border-slate-300 text-slate-700",
        destructive: "bg-red-100 text-red-700",
        success: "bg-green-100 text-green-700",
        warning: "bg-amber-100 text-amber-800",
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
