import * as React from "react";
import { cn } from "@/lib/utils";

/** Shared with Input so a select, a textarea and a text box in the same row
 *  never drift apart visually. */
const CONTROL =
  "w-full rounded-xl border border-white/10 bg-ink-700/60 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-brand focus:shadow-glow disabled:opacity-50";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  // appearance-none + a drawn chevron: Chrome's native arrow renders as a light
  // control on a dark field and looks broken.
  //
  // Position and repeat go in the inline style, not Tailwind classes. `bg-*`
  // covers background-color AND background-position, so tailwind-merge treats
  // `bg-[right_0.75rem_center]` as superseding `bg-ink-700/60` and strips the
  // colour — which rendered the select as a white pill.
  <select
    ref={ref}
    className={cn(CONTROL, "h-10 appearance-none pr-9", className)}
    style={{
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "right 0.75rem center",
    }}
    {...props}
  />
));
Select.displayName = "Select";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(CONTROL, "min-h-[6rem] resize-y leading-relaxed", className)} {...props} />
));
Textarea.displayName = "Textarea";

/** Label + control + optional hint/error, so every field in a form lines up. */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium text-slate-300">
        {label}
        {required && <span className="ml-0.5 text-brand">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-300">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

/** Checkbox styled to match, with the whole row as the hit target.
 *
 *  The native control is hidden rather than tinted with `accent-color`, which
 *  only colours the *checked* state — an unchecked native box stays light and
 *  read as a white square on this dark surface. The box below is drawn from
 *  `peer-checked`, so both states match the theme. `sr-only` (not `hidden`)
 *  keeps it focusable and announced. */
export function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer select-none items-center gap-2.5 rounded-xl bg-white/5 px-3 ring-1 ring-white/10 transition hover:bg-white/[0.07]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border border-white/20 bg-ink-700 text-ink-950 transition peer-checked:border-brand peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/50"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-3 w-3 transition-opacity ${checked ? "opacity-100" : "opacity-0"}`}
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <span className="text-sm text-slate-200">{label}</span>
    </label>
  );
}
