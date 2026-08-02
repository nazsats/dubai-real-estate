import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-brand/15 text-brand ring-1 ring-brand/30",
        muted: "bg-white/5 text-slate-300 ring-1 ring-white/10",
        gold: "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30",
        success: "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30",
        // Review states. Amber and red sit close together for a red-green
        // colour-blind viewer, so anything using these pairs an icon or the
        // status word alongside — never colour on its own.
        warn: "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30",
        danger: "bg-red-400/15 text-red-300 ring-1 ring-red-400/30",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
