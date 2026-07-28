"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Layers, Ruler, MapPinned } from "lucide-react";
import { api, MarketData } from "@/lib/api";
import { aed, num } from "@/lib/format";
import { StatTile } from "@/components/ui/stat-tile";
import { ChartSkeleton, StatRowSkeleton, Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import {
  AreaRadar,
  AreaTreemap,
  BedroomsDist,
  PpsfByArea,
  PriceBands,
  PriceRangeByType,
  ReadySplit,
  SizeVsPrice,
  TypeMixBars,
} from "@/components/market/MarketCharts";

export default function MarketPage() {
  const [data, setData] = useState<MarketData | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    api
      .get<MarketData>("/api/analytics/market")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;

  if (!data)
    return (
      <div className="space-y-6">
        <Header />
        <StatRowSkeleton />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
        <Skeleton className="h-[280px] w-full rounded-2xl" />
      </div>
    );

  if (data.stats.listings === 0)
    return (
      <div className="space-y-4">
        <Header />
        <div className="glass">
          <EmptyState
            icon={Building2}
            title="No inventory to analyse yet"
            description="Market trends are calculated from your listings. Import real Dubai listings or upload your own CSV, and the charts here will fill in automatically."
            actionLabel="Go to Listings"
            actionHref="/listings"
          />
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
          label="Listings analysed"
          value={num(s.listings)}
          caption="Everything these charts are based on"
          icon={Building2}
          tone="brand"
        />
        <StatTile index={1} label="Average price" value={aed(s.avg_price)} caption="Across all listings" icon={Layers} />
        <StatTile
          index={2}
          label="Average price / sqft"
          value={`AED ${num(s.avg_ppsf)}`}
          caption="Useful for spotting over-priced stock"
          icon={Ruler}
        />
        <StatTile index={3} label="Areas covered" value={num(s.areas)} caption="Distinct Dubai communities" icon={MapPinned} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Price distribution" subtitle="How many listings fall in each price band">
          <PriceBands data={data.price_bands} />
        </Card>
        <Card title="Bedroom mix" subtitle="Inventory by bedroom count">
          <BedroomsDist data={data.bedrooms_dist} />
        </Card>
        <Card title="Property type mix" subtitle="Which types you hold most of">
          <TypeMixBars data={data.type_mix} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card
          title="Price range by type"
          subtitle="Lowest, average and highest asking price"
          className="lg:col-span-2"
        >
          <PriceRangeByType data={data.price_range_by_type} />
        </Card>
        <Card title="Ready vs off-plan" subtitle="Completion status split">
          <ReadySplit data={data.ready_split} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Price per sqft by area" subtitle="The fairest way to compare areas">
          <PpsfByArea data={data.ppsf_by_area} />
        </Card>
        <Card title="Size vs price" subtitle="Each dot is one listing — outliers are worth a look">
          <SizeVsPrice data={data.scatter} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Top areas compared" subtitle="Each metric indexed to the strongest area">
          <AreaRadar radar={data.radar} />
        </Card>
        <Card title="Inventory share by area" subtitle="Bigger and deeper means more listings">
          <AreaTreemap data={data.area_treemap} />
        </Card>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-50">Market Trends</h1>
      <p className="mt-0.5 text-sm text-slate-400">
        Live analysis of your Dubai inventory. Import more listings to sharpen the picture.
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
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </motion.div>
  );
}
