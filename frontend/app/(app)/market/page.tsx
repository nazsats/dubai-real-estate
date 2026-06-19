"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Building2, Layers, Ruler, MapPinned } from "lucide-react";
import { api, MarketData } from "@/lib/api";
import { aed, num } from "@/lib/format";
import {
  AreaRadar,
  AreaTreemap,
  BedroomsDist,
  PpsfByArea,
  PriceBands,
  PriceRangeByType,
  ReadySplit,
  SizeVsPrice,
  TypeMixDonut,
} from "@/components/market/MarketCharts";

export default function MarketPage() {
  const [data, setData] = useState<MarketData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<MarketData>("/api/analytics/market")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-300">Failed to load market data: {error}</p>;
  if (!data)
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );

  if (data.stats.listings === 0)
    return (
      <div className="space-y-4">
        <Header />
        <div className="glass p-10 text-center text-slate-400">
          No inventory to analyze yet. Import listings on the <b>Listings</b> page first.
        </div>
      </div>
    );

  const s = data.stats;
  const cards = [
    { label: "Listings analyzed", value: num(s.listings), icon: Building2, accent: "from-brand to-brand-600" },
    { label: "Avg price", value: aed(s.avg_price), icon: Layers, accent: "from-purple-400 to-fuchsia-600" },
    { label: "Avg price / sqft", value: `AED ${num(s.avg_ppsf)}`, icon: Ruler, accent: "from-amber-300 to-yellow-600" },
    { label: "Areas covered", value: num(s.areas), icon: MapPinned, accent: "from-green-400 to-emerald-600" },
  ];

  return (
    <div className="space-y-6">
      <Header />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="glass p-4"
          >
            <div className={`mb-3 inline-flex rounded-xl bg-gradient-to-br ${c.accent} p-2 shadow-glow`}>
              <c.icon className="h-5 w-5 text-white" />
            </div>
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-xs text-slate-400">{c.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Price distribution (AED)"><PriceBands data={data.price_bands} /></Card>
        <Card title="Bedroom mix"><BedroomsDist data={data.bedrooms_dist} /></Card>
        <Card title="Property type mix"><TypeMixDonut data={data.type_mix} /></Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Price range by type" className="lg:col-span-2"><PriceRangeByType data={data.price_range_by_type} /></Card>
        <Card title="Ready vs off-plan"><ReadySplit data={data.ready_split} /></Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Price per sqft by area"><PpsfByArea data={data.ppsf_by_area} /></Card>
        <Card title="Size vs price (every listing)"><SizeVsPrice data={data.scatter} /></Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Top areas compared"><AreaRadar radar={data.radar} /></Card>
        <Card title="Inventory share by area"><AreaTreemap data={data.area_treemap} /></Card>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Market Trends</h1>
      <p className="text-sm text-slate-400">
        Live analysis of Dubai inventory. Import more listings to sharpen the picture.
      </p>
    </div>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={`glass p-4 ${className}`}>
      <h3 className="mb-3 text-sm font-semibold text-slate-300">{title}</h3>
      {children}
    </motion.div>
  );
}
