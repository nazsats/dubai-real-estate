"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BedDouble,
  Bath,
  Car,
  Maximize,
  MapPin,
  Mail,
  Phone,
  MessageCircle,
  Building2,
  CalendarClock,
  Hash,
  Sofa,
  Waves,
  Dumbbell,
  Wind,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Info,
  Loader2,
} from "lucide-react";
import { api, ApiError, PropertyDetail } from "@/lib/api";
import { aed } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

interface Comparable {
  area: string;
  building?: string | null;
  property_type?: string | null;
  rooms?: number | null;
  size_sqft?: number | null;
  price_aed: number;
  price_per_sqft?: number | null;
  transaction_date: string;
}

interface MarketContext {
  this_ppsf: number | null;
  benchmark_ppsf: number | null;
  benchmark_source: "dld" | "asking" | null;
  delta_pct: number | null;
  dld: { count: number; median_price: number; trend_pct: number | null } | null;
  asking: { count: number; median_ppsf: number | null };
  comparables: Comparable[];
}

const AMENITIES = [
  { key: "has_pool", label: "Pool", icon: Waves },
  { key: "has_gym", label: "Gym", icon: Dumbbell },
  { key: "has_balcony", label: "Balcony", icon: Wind },
  { key: "furnished", label: "Furnished", icon: Sofa },
] as const;

function Spec({ icon: Icon, label, value }: { icon: typeof BedDouble; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
      <Icon className="mb-1.5 h-4 w-4 text-brand" />
      <div className="text-sm font-semibold">{value}</div>
      <div className="text-[11px] text-slate-400">{label}</div>
    </div>
  );
}

/** Turns the ppsf delta into words. Colour alone can't carry "above/below
 *  market" — an arrow and the phrasing do the work, colour only reinforces. */
function PriceVerdict({ m }: { m: MarketContext }) {
  if (m.delta_pct === null || m.benchmark_ppsf === null) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-white/5 p-3 text-sm text-slate-300 ring-1 ring-white/10">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <span>
          No comparable sales or listings for this unit type in {""}
          <span className="text-slate-200">this area</span> yet, so there is nothing to price it
          against. Import DLD transactions to enable this.
        </span>
      </div>
    );
  }

  const d = m.delta_pct;
  const near = Math.abs(d) < 5;
  const Icon = near ? Minus : d > 0 ? TrendingUp : TrendingDown;
  const tone = near ? "text-slate-300" : d > 0 ? "text-amber-300" : "text-emerald-300";
  const word = near ? "in line with" : d > 0 ? `${d}% above` : `${Math.abs(d)}% below`;
  const source =
    m.benchmark_source === "dld"
      ? `recorded DLD sales (${m.dld?.count ?? 0} in the last 12 months)`
      : `current asking prices (${m.asking.count} similar listings)`;

  return (
    <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
      <div className={`flex items-center gap-2 text-sm font-semibold ${tone}`}>
        <Icon className="h-4 w-4" />
        Priced {word} the market
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        AED {m.this_ppsf?.toLocaleString()}/sqft here vs a median of AED{" "}
        {m.benchmark_ppsf.toLocaleString()}/sqft from {source}.
        {m.benchmark_source === "asking" && (
          <> Asking prices are what agents want, not what buyers paid.</>
        )}
      </p>
    </div>
  );
}

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [p, setP] = useState<PropertyDetail | null>(null);
  const [market, setMarket] = useState<MarketContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await api.get<PropertyDetail>(`/api/listings/${id}`);
      setP(detail);
      // Market context is secondary — a failure here must not blank the page,
      // so it's fetched separately and its error swallowed.
      api
        .get<MarketContext>(`/api/listings/${id}/market`)
        .then(setMarket)
        .catch(() => setMarket(null));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load this property");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-4">
            <Skeleton className="h-64 w-full sm:h-80" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !p) {
    return (
      <div className="glass">
        <EmptyState
          icon={AlertTriangle}
          title="Property not available"
          description={error ?? "This listing may have been withdrawn, or it isn't visible to your agency."}
          actionLabel="Back to listings"
          onAction={() => router.push("/listings")}
        />
      </div>
    );
  }

  const agent = p.listed_by;
  const enquiry = `Hi ${agent?.full_name?.split(" ")[0] ?? "there"}, I'm interested in ${p.building} (${p.location}) listed at ${aed(p.price, false)}. Is it still available?`;

  return (
    <div className="space-y-5">
      <Link
        href="/listings"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to listings
      </Link>

      {/* Author-visible review banner. Only reaches here for the submitter or
          an admin — the API 404s this listing for everyone else. */}
      {p.status === "rejected" && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-300">
            <AlertTriangle className="h-4 w-4" /> Rejected in review
          </div>
          <p className="mt-1 text-sm text-slate-300">{p.rejection_reason}</p>
          <Link href="/my-listings">
            <Button size="sm" variant="secondary" className="mt-3">
              Edit and resubmit
            </Button>
          </Link>
        </div>
      )}
      {p.status === "pending" && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
          <span className="font-semibold">Awaiting verification.</span> Only you and your admin can
          see this listing until it&apos;s approved.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ── Main column ── */}
        <div className="min-w-0 space-y-5">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass overflow-hidden p-0"
          >
            <div className="relative h-56 w-full bg-ink-700 sm:h-80">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt={p.building} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-600">
                  <Building2 className="h-12 w-12" />
                </div>
              )}
              <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                <Badge variant="muted">{p.type}</Badge>
                {p.source === "bayut" && <Badge variant="gold">Live from Bayut</Badge>}
                {p.source === "broker" && p.status === "approved" && (
                  <Badge variant="success">Verified listing</Badge>
                )}
                {!p.available && <Badge variant="danger">Off market</Badge>}
              </div>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-bold sm:text-2xl">{p.building}</h1>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
                    <MapPin className="h-4 w-4 shrink-0" /> {p.location}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-brand sm:text-2xl">{aed(p.price, false)}</div>
                  {p.size_sqft > 0 && (
                    <div className="text-xs text-slate-400">
                      AED {Math.round(p.price / p.size_sqft).toLocaleString()}/sqft
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Spec
                  icon={BedDouble}
                  label="Bedrooms"
                  value={p.bedrooms ? `${p.bedrooms}` : "Studio"}
                />
                <Spec icon={Bath} label="Bathrooms" value={p.bathrooms ? `${p.bathrooms}` : "—"} />
                <Spec
                  icon={Maximize}
                  label="Built-up area"
                  value={p.size_sqft ? `${p.size_sqft.toLocaleString()} sqft` : "—"}
                />
                <Spec icon={Car} label="Parking" value={p.parking != null ? `${p.parking}` : "—"} />
              </div>

              <div className="flex flex-wrap gap-2">
                {AMENITIES.filter((a) => p[a.key]).map(({ key, label, icon: Icon }) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs text-brand ring-1 ring-brand/25"
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300 ring-1 ring-white/10">
                  <CalendarClock className="h-3.5 w-3.5" /> {p.possession}
                </span>
                {p.reference && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400 ring-1 ring-white/10">
                    <Hash className="h-3.5 w-3.5" /> {p.reference}
                  </span>
                )}
              </div>

              {p.description && (
                <div>
                  <h2 className="mb-1.5 text-sm font-semibold text-slate-200">About this property</h2>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
                    {p.description}
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {/* ── Market context ── */}
          <div className="glass space-y-3">
            <h2 className="text-sm font-semibold text-slate-200">Price in context</h2>
            {market ? (
              <>
                <PriceVerdict m={market} />
                {market.comparables.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs text-slate-400">
                      Recent recorded sales nearby — what you show a buyer who asks &ldquo;why that
                      price?&rdquo;
                    </p>
                    <div className="-mx-1 overflow-x-auto px-1">
                      <table className="w-full min-w-[30rem] text-left text-xs">
                        <thead className="text-slate-500">
                          <tr>
                            <th className="pb-2 font-medium">Building</th>
                            <th className="pb-2 font-medium">Beds</th>
                            <th className="pb-2 font-medium">Size</th>
                            <th className="pb-2 text-right font-medium">Sold for</th>
                            <th className="pb-2 text-right font-medium">/sqft</th>
                            <th className="pb-2 text-right font-medium">Date</th>
                          </tr>
                        </thead>
                        <tbody className="text-slate-300">
                          {market.comparables.map((c, i) => (
                            <tr key={i} className="border-t border-white/5">
                              <td className="max-w-[10rem] truncate py-2">{c.building || c.area}</td>
                              <td className="py-2">{c.rooms ?? "—"}</td>
                              <td className="py-2">
                                {c.size_sqft ? `${c.size_sqft.toLocaleString()}` : "—"}
                              </td>
                              <td className="py-2 text-right">{aed(c.price_aed)}</td>
                              <td className="py-2 text-right">
                                {c.price_per_sqft ? Math.round(c.price_per_sqft).toLocaleString() : "—"}
                              </td>
                              <td className="py-2 text-right text-slate-500">
                                {c.transaction_date?.slice(0, 7)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading market data…
              </div>
            )}
          </div>
        </div>

        {/* ── Contact rail ── */}
        <aside className="lg:sticky lg:top-5 lg:self-start">
          <div className="glass space-y-3">
            <h2 className="text-sm font-semibold text-slate-200">
              {agent ? "Listed by" : "Listing source"}
            </h2>

            {agent ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-600 text-sm font-bold text-ink-950">
                    {agent.full_name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{agent.full_name}</div>
                    {p.agency_name && (
                      <div className="truncate text-xs text-slate-400">{p.agency_name}</div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {agent.phone && (
                    <>
                      <a href={`tel:${agent.phone}`} className="block">
                        <Button variant="secondary" className="w-full justify-start">
                          <Phone className="h-4 w-4" /> {agent.phone}
                        </Button>
                      </a>
                      <a
                        href={`https://wa.me/${agent.phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(enquiry)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <Button className="w-full justify-start">
                          <MessageCircle className="h-4 w-4" /> WhatsApp
                        </Button>
                      </a>
                    </>
                  )}
                  <a
                    href={`mailto:${agent.email}?subject=${encodeURIComponent(`Enquiry: ${p.building}`)}&body=${encodeURIComponent(enquiry)}`}
                    className="block"
                  >
                    <Button variant="secondary" className="w-full justify-start">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{agent.email}</span>
                    </Button>
                  </a>
                </div>

                {!agent.phone && (
                  <p className="text-xs text-slate-500">
                    No phone on file for this agent — add one in your profile so buyers can call and
                    WhatsApp you directly.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400">
                {p.source === "bayut"
                  ? "Imported from the public Bayut feed. There's no named agent on this record — contact the portal listing directly."
                  : p.agency_name
                    ? `Agency stock at ${p.agency_name}, with no individual agent assigned.`
                    : "Shared market data with no assigned agent."}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
