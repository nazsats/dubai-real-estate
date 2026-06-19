"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardData } from "@/lib/api";
import { aed } from "@/lib/format";

const PIE_COLORS = ["#2dd4ff", "#38bdf8", "#6366f1", "#34d399", "#e3b341", "#a855f7", "#f472b6"];

const tooltipStyle = {
  background: "#141b2e",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  color: "#e2e8f0",
  fontSize: 12,
  boxShadow: "0 16px 40px -20px rgba(0,0,0,0.8)",
};

export function LeadsOverTime({ data }: { data: DashboardData["leads_over_time"] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2dd4ff" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#2dd4ff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(d) => String(d).slice(5)} />
        <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="count" stroke="#2dd4ff" strokeWidth={2.5} fill="url(#leadGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function AvgPriceByArea({ data }: { data: DashboardData["avg_price_by_area"] }) {
  const top = data.slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={top} layout="vertical" margin={{ left: 30, right: 16 }}>
        <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => aed(v)} />
        <YAxis type="category" dataKey="location" width={110} tick={{ fill: "#94a3b8", fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => aed(v, false)} />
        <Bar dataKey="avg_price" radius={[0, 6, 6, 0]}>
          {top.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PropertyTypeDonut({ data }: { data: DashboardData["properties_by_type"] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="type" innerRadius={55} outerRadius={90} paddingAngle={3}>
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function LeadsByStageBar({ data }: { data: DashboardData["leads_by_stage"] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, left: -20 }}>
        <XAxis dataKey="stage" tick={{ fill: "#64748b", fontSize: 10 }} interval={0} angle={-15} dy={8} />
        <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
