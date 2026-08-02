"use client";

import Link from "next/link";
import { BedDouble, Maximize, MapPin } from "lucide-react";
import { Property } from "@/lib/api";
import { aed } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

/** Review states an agent sees on their own submissions. Approved stock shows
 *  no badge — the absence of one is the normal case and a badge on every card
 *  would just be noise. */
const STATUS_BADGE: Record<string, { label: string; variant: "warn" | "danger" }> = {
  pending: { label: "In review", variant: "warn" },
  rejected: { label: "Rejected", variant: "danger" },
};

export default function PropertyCard({
  p,
  action,
  size = "sm",
}: {
  p: Property & { status?: string };
  /** Rendered below the details, outside the link so its clicks don't navigate. */
  action?: React.ReactNode;
  /** "md" is the roomier variant used on the listings grid. */
  size?: "sm" | "md";
}) {
  const md = size === "md";
  const status = p.status && STATUS_BADGE[p.status];

  return (
    <div className="glass card-hover group overflow-hidden p-0">
      {/* The whole card body is one link so the tap target is the card, not a
          small "view" button — this is a grid people scan on a phone. */}
      <Link href={`/listings/${p.id}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand">
        <div className={`relative w-full overflow-hidden bg-ink-700 ${md ? "h-44" : "h-36"}`}>
          {p.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.image_url}
              alt={p.building}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-600">
              <MapPin className={md ? "h-8 w-8" : "h-7 w-7"} />
            </div>
          )}
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            <Badge variant="muted">{p.type}</Badge>
            {p.source === "bayut" && <Badge variant="gold">Live</Badge>}
            {status && <Badge variant={status.variant}>{status.label}</Badge>}
          </div>
          <div className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-2 py-1 text-sm font-bold text-brand backdrop-blur">
            {aed(p.price)}
          </div>
        </div>
        <div className={md ? "p-4" : "p-3"}>
          <div className={`truncate font-semibold ${md ? "" : "text-sm"}`} title={p.building}>
            {p.building}
          </div>
          <div className="flex items-center gap-1 truncate text-xs text-slate-400">
            <MapPin className="h-3 w-3 shrink-0" /> {p.location}
          </div>
          <div className={`flex items-center gap-3 text-xs text-slate-300 ${md ? "mt-3" : "mt-2"}`}>
            <span className="flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5" /> {p.bedrooms || "Studio"}
            </span>
            <span className="flex items-center gap-1">
              <Maximize className="h-3.5 w-3.5" />{" "}
              {p.size_sqft ? `${p.size_sqft.toLocaleString()} sqft` : "—"}
            </span>
            {md && <span className="ml-auto text-slate-500">{p.possession}</span>}
          </div>
        </div>
      </Link>
      {action && <div className={`${md ? "px-4 pb-4" : "px-3 pb-3"}`}>{action}</div>}
    </div>
  );
}
