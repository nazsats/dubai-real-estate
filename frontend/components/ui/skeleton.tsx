import { cn } from "@/lib/utils";

/**
 * Loading placeholder shaped like the content it replaces.
 *
 * A skeleton that matches the real layout makes a page feel materially faster
 * than a centred spinner, because nothing jumps when the data lands.
 */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn(
        "relative overflow-hidden rounded-lg bg-white/[0.04]",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer",
        "after:bg-gradient-to-r after:from-transparent after:via-white/[0.06] after:to-transparent",
        className
      )}
    />
  );
}

/** Stat-tile row placeholder. */
export function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass p-4">
          <Skeleton className="mb-3 h-9 w-9 rounded-xl" />
          <Skeleton className="mb-2 h-7 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Chart-card placeholder. */
export function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div className="glass p-4">
      <Skeleton className="mb-4 h-4 w-40" />
      <Skeleton style={{ height }} className="w-full" />
    </div>
  );
}

/** Generic list placeholder. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}
