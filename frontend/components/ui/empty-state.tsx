import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Empty state with a way forward.
 *
 * A blank panel saying "Empty" tells an agent nothing. Every empty state here
 * names what belongs in the space and gives them the one action that fills it.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "gap-2 p-6" : "gap-3 p-10"
      }`}
    >
      <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
        <Icon className={compact ? "h-5 w-5 text-slate-400" : "h-6 w-6 text-slate-400"} />
      </div>
      <div>
        <p className={`font-semibold text-slate-200 ${compact ? "text-sm" : "text-base"}`}>{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-400">{description}</p>
      </div>
      {actionLabel && actionHref && (
        <Button asChild size="sm" className="mt-1">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
      {actionLabel && onAction && (
        <Button size="sm" className="mt-1" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

/** Consistent, non-alarming error panel with a retry affordance. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="glass flex flex-col items-center gap-3 p-8 text-center">
      <div className="rounded-2xl bg-red-500/10 p-3 ring-1 ring-red-500/20">
        <svg className="h-6 w-6 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </div>
      <div>
        <p className="font-semibold text-slate-200">Couldn&apos;t load this</p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-400">{message}</p>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
