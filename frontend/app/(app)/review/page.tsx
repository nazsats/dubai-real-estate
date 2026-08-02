"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ShieldCheck,
  Check,
  X,
  Clock,
  Loader2,
  MapPin,
  BedDouble,
  Maximize,
  Mail,
  Phone,
  Lock,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, PropertyDetail, ReviewCounts } from "@/lib/api";
import { aed } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/field";

const TABS = [
  { key: "pending", label: "Awaiting review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
] as const;

/** Common reasons, one tap each. Most rejections are one of these, and a
 *  prefilled reason is far more likely to be specific than a blank box at the
 *  end of a review session. */
const QUICK_REASONS = [
  "Price looks wrong for this area and unit size — please double-check.",
  "Photo doesn't match the property described.",
  "Missing detail a buyer will ask for (floor, view, service charge).",
  "We can't verify you hold this listing. Send the Form A.",
];

function RejectPanel({
  onCancel,
  onConfirm,
  busy,
}: {
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  busy: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden border-t border-white/10"
    >
      <div className="space-y-3 p-4">
        <p className="text-xs text-slate-400">
          The broker sees this verbatim and resubmits against it, so say what to change.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className="rounded-full bg-white/5 px-3 py-1 text-left text-[11px] text-slate-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
            >
              {r.length > 44 ? `${r.slice(0, 44)}…` : r}
            </button>
          ))}
        </div>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Why is this being rejected?"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            Confirm rejection
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function ReviewPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("pending");
  const [items, setItems] = useState<PropertyDetail[]>([]);
  const [counts, setCounts] = useState<ReviewCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [queue, c] = await Promise.all([
        api.get<PropertyDetail[]>(`/api/listings/review/queue?status=${tab}`),
        api.get<ReviewCounts>("/api/listings/review/counts"),
      ]);
      setItems(queue);
      setCounts(c);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not load the review queue");
    } finally {
      setLoading(false);
    }
  }, [tab, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  async function review(p: PropertyDetail, approve: boolean, reason?: string) {
    setBusyId(p.id);
    try {
      await api.post(`/api/listings/${p.id}/review`, { approve, reason });
      // Drop it from the current tab immediately — leaving a just-approved row
      // in "Awaiting review" makes it look like the click didn't register.
      setItems((prev) => prev.filter((x) => x.id !== p.id));
      setRejecting(null);
      toast.success(approve ? `${p.building} is now live` : `${p.building} sent back to the broker`);
      api.get<ReviewCounts>("/api/listings/review/counts").then(setCounts).catch(() => {});
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Review failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!isAdmin) {
    return (
      <div className="glass">
        <EmptyState
          icon={Lock}
          title="Admins only"
          description="Listing verification is restricted to agency admins. If you need to submit a property, use My Listings instead."
          actionLabel="Go to my listings"
          onAction={() => (window.location.href = "/my-listings")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ShieldCheck className="h-6 w-6 text-brand" /> Verify listings
          </h1>
          <p className="text-sm text-slate-400">
            Nothing here is visible in search, on the grid, or to the AI until you approve it.
          </p>
        </div>
        {counts && counts.pending > 0 && (
          <Badge variant="warn" className="gap-1.5 px-3 py-1.5 text-sm">
            <Clock className="h-4 w-4" /> {counts.pending} waiting
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setRejecting(null);
            }}
            className={`min-h-9 rounded-full px-3.5 text-xs font-medium transition ${
              tab === t.key
                ? "bg-brand/15 text-brand ring-1 ring-brand/30"
                : "bg-white/5 text-slate-400 ring-1 ring-white/10 hover:text-slate-200"
            }`}
          >
            {t.label} {counts ? `(${counts[t.key]})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="glass">
          <EmptyState
            icon={Inbox}
            title={tab === "pending" ? "Queue is clear" : `Nothing ${tab}`}
            description={
              tab === "pending"
                ? "Every broker submission has been reviewed. New ones appear here oldest-first, so nobody's listing sits at the back of the queue."
                : `No listings in the ${tab} state yet.`
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
              className="glass overflow-hidden p-0"
            >
              <div className="flex flex-col gap-4 p-4 lg:flex-row">
                <Link
                  href={`/listings/${p.id}`}
                  className="h-40 w-full shrink-0 overflow-hidden rounded-xl bg-ink-700 lg:h-28 lg:w-44"
                >
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.building} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1 text-slate-600">
                      <MapPin className="h-6 w-6" />
                      <span className="text-[10px]">No photo</span>
                    </div>
                  )}
                </Link>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/listings/${p.id}`} className="block truncate font-semibold hover:text-brand">
                        {p.building}
                      </Link>
                      <div className="flex items-center gap-1 truncate text-xs text-slate-400">
                        <MapPin className="h-3 w-3 shrink-0" /> {p.location}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-brand">{aed(p.price, false)}</div>
                      {p.size_sqft > 0 && (
                        <div className="text-[11px] text-slate-400">
                          AED {Math.round(p.price / p.size_sqft).toLocaleString()}/sqft
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                    <span className="flex items-center gap-1">
                      <BedDouble className="h-3.5 w-3.5" /> {p.bedrooms || "Studio"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Maximize className="h-3.5 w-3.5" /> {p.size_sqft?.toLocaleString()} sqft
                    </span>
                    <Badge variant="muted">{p.type}</Badge>
                    <Badge variant="muted">{p.possession}</Badge>
                    {p.reference && <span className="text-slate-500">Ref {p.reference}</span>}
                  </div>

                  {p.description && (
                    <p className="line-clamp-2 text-xs leading-relaxed text-slate-400">
                      {p.description}
                    </p>
                  )}

                  {p.listed_by && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/5 pt-2 text-xs text-slate-400">
                      <span className="text-slate-300">{p.listed_by.full_name}</span>
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {p.listed_by.email}
                      </span>
                      {p.listed_by.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {p.listed_by.phone}
                        </span>
                      )}
                      {p.submitted_at && (
                        <span className="ml-auto text-slate-500">
                          Submitted {new Date(p.submitted_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}

                  {p.status === "rejected" && p.rejection_reason && (
                    <p className="text-xs text-red-300">Rejected: {p.rejection_reason}</p>
                  )}
                </div>

                <div className="flex shrink-0 flex-row gap-2 lg:flex-col lg:justify-center">
                  {p.status !== "approved" && (
                    <Button
                      size="sm"
                      className="flex-1 lg:flex-none"
                      disabled={busyId === p.id}
                      onClick={() => review(p, true)}
                    >
                      {busyId === p.id && rejecting !== p.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Approve
                    </Button>
                  )}
                  {p.status !== "rejected" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1 lg:flex-none"
                      disabled={busyId === p.id}
                      onClick={() => setRejecting(rejecting === p.id ? null : p.id)}
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </Button>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {rejecting === p.id && (
                  <RejectPanel
                    busy={busyId === p.id}
                    onCancel={() => setRejecting(null)}
                    onConfirm={(reason) => review(p, false, reason)}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
