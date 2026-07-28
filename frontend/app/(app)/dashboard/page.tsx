"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Users, Building2, TrendingUp, Wallet } from "lucide-react";
import { api, DashboardData } from "@/lib/api";
import { aed, num } from "@/lib/format";
import { STAGE_RAMP, STATUS } from "@/lib/viz";
import { StatTile } from "@/components/ui/stat-tile";
import { ChartSkeleton, Skeleton, StatRowSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/empty-state";
import {
  AvgPriceByArea,
  LeadsByStageBar,
  LeadsOverTime,
  PropertyTypeBars,
} from "@/components/dashboard/Charts";

// Leaflet must render client-side only.
const UAEMap = dynamic(() => import("@/components/dashboard/UAEMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-xl" />,
});

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    api
      .get<DashboardData>("/api/analytics/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;

  // Skeletons mirror the real layout so nothing shifts when data lands.
  if (!data)
    return (
      <div className="space-y-6">
        <Header />
        <StatRowSkeleton />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ChartSkeleton height={420} />
          </div>
          <ChartSkeleton />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );

  const s = data.stats;

  return (
    <div className="space-y-6">
      <Header />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          index={0}
          label="Total leads"
          value={num(s.leads)}
          caption={`${num(s.open_deals)} deals currently open`}
          icon={Users}
          tone="brand"
        />
        <StatTile
          index={1}
          label="Live listings"
          value={num(s.properties)}
          caption="Your inventory plus the shared pool"
          icon={Building2}
        />
        <StatTile
          index={2}
          label="Pipeline value"
          value={aed(s.pipeline_value)}
          caption="Total value of deals not yet closed"
          icon={TrendingUp}
        />
        <StatTile
          index={3}
          label="Commission won"
          value={aed(s.commission_won)}
          caption={`Earned across ${num(s.won_deals)} closed deals`}
          icon={Wallet}
          tone="good"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Market map"
          subtitle="Circle size is inventory; colour is the average price band."
        >
          <div className="h-[420px] overflow-hidden rounded-xl">
            <UAEMap markers={data.area_markers} />
          </div>
          <Legend />
        </Card>
        <Card title="New leads" subtitle="Last 30 days">
          <LeadsOverTime data={data.leads_over_time} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Average price by area" subtitle="Top 8 areas by price">
          <AvgPriceByArea data={data.avg_price_by_area} />
        </Card>
        <Card title="Leads by stage" subtitle="Colour deepens as leads progress">
          <LeadsByStageBar data={data.leads_by_stage} />
        </Card>
        <Card title="Inventory by type" subtitle="How your listings break down">
          <PropertyTypeBars data={data.properties_by_type} />
        </Card>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-50">Dashboard</h1>
      <p className="mt-0.5 text-sm text-slate-400">
        Live overview of your market, leads, and revenue.
      </p>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`glass p-4 ${className}`}
    >
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      {subtitle && <p className="mb-3 mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </motion.div>
  );
}

/**
 * Map key. The map encodes price as an ordered set of bands, so the swatches
 * use the same ordinal ramp as the pipeline rather than unrelated hues, and
 * each band is labelled — colour never carries the meaning alone.
 */
function Legend() {
  const items = [
    { c: STATUS.warning, l: "15M+" },
    { c: STAGE_RAMP[4], l: "6–15M" },
    { c: STAGE_RAMP[3], l: "2.5–6M" },
    { c: STAGE_RAMP[1], l: "Under 2.5M" },
  ];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-400">
      <span className="text-slate-500">Avg price:</span>
      {items.map((it) => (
        <span key={it.l} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: it.c }} /> {it.l}
        </span>
      ))}
    </div>
  );
}
