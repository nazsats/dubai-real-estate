import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-xl border border-white/10 bg-ink-700/60 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-brand focus:shadow-glow disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
