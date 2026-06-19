"use client";

import { BedDouble, Maximize, MapPin } from "lucide-react";
import { Property } from "@/lib/api";
import { aed } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export default function PropertyCard({ p, action }: { p: Property; action?: React.ReactNode }) {
  return (
    <div className="glass card-hover overflow-hidden p-0">
      <div className="relative h-36 w-full overflow-hidden bg-ink-700">
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt={p.building} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-600">
            <MapPin className="h-7 w-7" />
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          <Badge variant="muted">{p.type}</Badge>
          {p.source === "bayut" && <Badge variant="gold">Live</Badge>}
        </div>
        <div className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-2 py-1 text-sm font-bold text-brand backdrop-blur">
          {aed(p.price)}
        </div>
      </div>
      <div className="p-3">
        <div className="truncate text-sm font-semibold" title={p.building}>
          {p.building}
        </div>
        <div className="flex items-center gap-1 truncate text-xs text-slate-400">
          <MapPin className="h-3 w-3" /> {p.location}
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-300">
          <span className="flex items-center gap-1">
            <BedDouble className="h-3.5 w-3.5" /> {p.bedrooms || "Studio"}
          </span>
          <span className="flex items-center gap-1">
            <Maximize className="h-3.5 w-3.5" /> {p.size_sqft ? `${p.size_sqft.toLocaleString()} sqft` : "—"}
          </span>
        </div>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
