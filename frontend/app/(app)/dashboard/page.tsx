"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Users, Building2, TrendingUp, Wallet, Loader2 } from "lucide-react";
import { api, DashboardData } from "@/lib/api";
import { aed, num } from "@/lib/format";
import {
  AvgPriceByArea,
  LeadsByStageBar,
  LeadsOverTime,
  PropertyTypeDonut,
} from "@/components/dashboard/Charts";

// Leaflet must render client-side only.
const UAEMap = dynamic(() => import("@/components/dashboard/UAEMap"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-slate-500">Loading map…</div>,
});

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<DashboardData>("/api/analytics/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-300">Failed to load dashboard: {error}</p>;
  if (!data)
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );

  const s = data.stats;
  const stats = [
    { label: "Total Leads", value: num(s.leads), icon: Users, accent: "from-brand to-brand-600" },
    { label: "Live Listings", value: num(s.properties), icon: Building2, accent: "from-green-400 to-emerald-600" },
    { label: "Pipeline Value", value: aed(s.pipeline_value), icon: TrendingUp, accent: "from-purple-400 to-fuchsia-600" },
    { label: "Commission Won", value: aed(s.commission_won), icon: Wallet, accent: "from-amber-300 to-yellow-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-slate-400">Live overview of your market, leads, and revenue.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((st, i) => (
          <motion.div
            key={st.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="glass p-4"
          >
            <div className={`mb-3 inline-flex rounded-xl bg-gradient-to-br ${st.accent} p-2 shadow-glow`}>
              <st.icon className="h-5 w-5 text-white" />
            </div>
            <div className="text-2xl font-bold">{st.value}</div>
            <div className="text-xs text-slate-400">{st.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Map + leads trend */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Market map — inventory & avg price by area">
          <div className="h-[360px] overflow-hidden rounded-xl">
            <UAEMap markers={data.area_markers} />
          </div>
          <Legend />
        </Card>
        <Card title="New leads (30 days)">
          <LeadsOverTime data={data.leads_over_time} />
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Avg price by area">
          <AvgPriceByArea data={data.avg_price_by_area} />
        </Card>
        <Card title="Leads by stage">
          <LeadsByStageBar data={data.leads_by_stage} />
        </Card>
        <Card title="Inventory by type">
          <PropertyTypeDonut data={data.properties_by_type} />
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass p-4 ${className}`}
    >
      <h3 className="mb-3 text-sm font-semibold text-slate-300">{title}</h3>
      {children}
    </motion.div>
  );
}

function Legend() {
  const items = [
    { c: "#d4af37", l: "Ultra prime 15M+" },
    { c: "#00c6ff", l: "Prime 6M+" },
    { c: "#22c55e", l: "Mid 2.5M+" },
    { c: "#a855f7", l: "Value" },
  ];
  return (
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
      {items.map((it) => (
        <span key={it.l} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: it.c }} /> {it.l}
        </span>
      ))}
    </div>
  );
}
