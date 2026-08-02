"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  MapPin,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, PropertyDetail } from "@/lib/api";
import { aed } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

/** Icon carries the state as well as the colour — amber/red/green are close
 *  enough under deuteranopia that colour alone wouldn't distinguish them. */
const STATUS = {
  pending: { label: "In review", icon: Clock, variant: "warn" as const },
  approved: { label: "Live", icon: CheckCircle2, variant: "success" as const },
  rejected: { label: "Rejected", icon: XCircle, variant: "danger" as const },
};

const FILTERS = ["all", "pending", "approved", "rejected"] as const;

export default function MyListingsPage() {
  const [items, setItems] = useState<PropertyDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  async function load() {
    setLoading(true);
    try {
      setItems(await api.get<PropertyDetail[]>("/api/listings/mine"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not load your listings");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function withdraw(p: PropertyDetail) {
    if (!confirm(`Withdraw "${p.building}"? This removes the listing permanently.`)) return;
    try {
      await api.del(`/api/listings/${p.id}`);
      setItems((prev) => prev.filter((x) => x.id !== p.id));
      toast.success("Listing withdrawn");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not withdraw");
    }
  }

  const counts = FILTERS.reduce<Record<string, number>>(
    (acc, f) => ({ ...acc, [f]: f === "all" ? items.length : items.filter((i) => i.status === f).length }),
    {}
  );
  const shown = filter === "all" ? items : items.filter((i) => i.status === filter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My listings</h1>
          <p className="text-sm text-slate-400">
            Properties you&apos;ve submitted, and where each one is in review.
          </p>
        </div>
        <Link href="/my-listings/new" className="w-full sm:w-auto">
          <Button className="w-full">
            <Plus className="h-4 w-4" /> List a property
          </Button>
        </Link>
      </div>

      {!loading && items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`min-h-9 rounded-full px-3.5 text-xs font-medium capitalize transition ${
                filter === f
                  ? "bg-brand/15 text-brand ring-1 ring-brand/30"
                  : "bg-white/5 text-slate-400 ring-1 ring-white/10 hover:text-slate-200"
              }`}
            >
              {f} ({counts[f] ?? 0})
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="glass">
          <EmptyState
            icon={Building2}
            title="You haven't listed anything yet"
            description="Add a property with its price, size and photos. An admin verifies it before it becomes visible in search, on the listings grid, and to the AI assistant — so buyers only ever see checked stock."
            actionLabel="List a property"
            onAction={() => (window.location.href = "/my-listings/new")}
          />
        </div>
      ) : shown.length === 0 ? (
        <div className="glass py-8 text-center text-sm text-slate-400">
          Nothing {filter} right now.
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((p, i) => {
            const s = STATUS[p.status as keyof typeof STATUS] ?? STATUS.pending;
            const Icon = s.icon;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                className="glass p-0"
              >
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <Link
                    href={`/listings/${p.id}`}
                    className="h-20 w-full shrink-0 overflow-hidden rounded-xl bg-ink-700 sm:h-16 sm:w-24"
                  >
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt={p.building} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-600">
                        <MapPin className="h-5 w-5" />
                      </div>
                    )}
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link href={`/listings/${p.id}`} className="block">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold">{p.building}</span>
                        <Badge variant={s.variant} className="gap-1">
                          <Icon className="h-3 w-3" /> {s.label}
                        </Badge>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-400">
                        {p.location} · {p.bedrooms || "Studio"} bed ·{" "}
                        {p.size_sqft?.toLocaleString()} sqft
                      </div>
                      <div className="mt-1 text-sm font-semibold text-brand">{aed(p.price)}</div>
                    </Link>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Link href={`/my-listings/${p.id}/edit`}>
                      <Button variant="secondary" size="sm">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => withdraw(p)}>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Withdraw</span>
                    </Button>
                  </div>
                </div>

                {p.status === "rejected" && p.rejection_reason && (
                  <div className="border-t border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm">
                    <span className="font-medium text-red-300">Why it was rejected: </span>
                    <span className="text-slate-300">{p.rejection_reason}</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
