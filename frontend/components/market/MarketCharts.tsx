"use client";

import {
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Scatter,
  ScatterChart,
  RadialBar,
  RadialBarChart,
  Treemap,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  Legend,
} from "recharts";
import { MarketData } from "@/lib/api";
import { aed } from "@/lib/format";

const C = ["#2dd4ff", "#38bdf8", "#6366f1", "#34d399", "#e3b341", "#a855f7", "#f472b6", "#14b8a6"];
const tip = {
  background: "#141b2e",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  color: "#e2e8f0",
  fontSize: 12,
  boxShadow: "0 16px 40px -20px rgba(0,0,0,0.8)",
};

export function PriceBands({ data }: { data: MarketData["price_bands"] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: -18, top: 8 }}>
        <XAxis dataKey="band" tick={{ fill: "#64748b", fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} />
        <Tooltip contentStyle={tip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={C[i % C.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BedroomsDist({ data }: { data: MarketData["bedrooms_dist"] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: -18, top: 8 }}>
        <XAxis dataKey="beds" tick={{ fill: "#64748b", fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} />
        <Tooltip contentStyle={tip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#2dd4ff" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TypeMixDonut({ data }: { data: MarketData["type_mix"] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="type" innerRadius={55} outerRadius={90} paddingAngle={3}>
          {data.map((_, i) => (
            <Cell key={i} fill={C[i % C.length]} stroke="none" />
          ))}
        </Pie>
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Tooltip contentStyle={tip} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ReadySplit({ data }: { data: MarketData["ready_split"] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadialBarChart innerRadius="35%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
        <RadialBar dataKey="count" background cornerRadius={8}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? "#34d399" : "#6366f1"} />
          ))}
        </RadialBar>
        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
        <Tooltip contentStyle={tip} />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

export function PriceRangeByType({ data }: { data: MarketData["price_range_by_type"] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ left: 6, top: 8 }}>
        <XAxis dataKey="type" tick={{ fill: "#64748b", fontSize: 11 }} />
        <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => aed(v)} />
        <Tooltip contentStyle={tip} formatter={(v: number) => aed(v, false)} />
        <Bar dataKey="max" fill="#38bdf8" radius={[6, 6, 0, 0]} opacity={0.35} name="Max" />
        <Bar dataKey="min" fill="#141b2e" radius={[6, 6, 0, 0]} name="Min" />
        <Line type="monotone" dataKey="avg" stroke="#e3b341" strokeWidth={2.5} name="Avg" dot={{ r: 3 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function PpsfByArea({ data }: { data: MarketData["ppsf_by_area"] }) {
  const top = data.slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={top} layout="vertical" margin={{ left: 36, right: 12 }}>
        <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => `${v}`} />
        <YAxis type="category" dataKey="location" width={110} tick={{ fill: "#94a3b8", fontSize: 11 }} />
        <Tooltip contentStyle={tip} formatter={(v: number) => `AED ${v.toLocaleString()}/sqft`} />
        <Bar dataKey="ppsf" radius={[0, 6, 6, 0]}>
          {top.map((_, i) => (
            <Cell key={i} fill={C[i % C.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SizeVsPrice({ data }: { data: MarketData["scatter"] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart margin={{ left: 6, top: 8 }}>
        <XAxis
          type="number"
          dataKey="size"
          name="Size"
          tick={{ fill: "#64748b", fontSize: 11 }}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          unit=" sqft"
        />
        <YAxis
          type="number"
          dataKey="price"
          name="Price"
          tick={{ fill: "#64748b", fontSize: 11 }}
          tickFormatter={(v) => aed(v)}
        />
        <ZAxis range={[30, 30]} />
        <Tooltip contentStyle={tip} cursor={{ strokeDasharray: "3 3" }} formatter={(v: number) => v.toLocaleString()} />
        <Scatter data={data} fill="#2dd4ff" fillOpacity={0.5} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function AreaRadar({ radar }: { radar: MarketData["radar"] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={radar.data} outerRadius={100}>
        <PolarGrid stroke="rgba(255,255,255,0.1)" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: "#94a3b8", fontSize: 11 }} />
        {radar.areas.map((area, i) => (
          <Radar key={area} dataKey={area} stroke={C[i % C.length]} fill={C[i % C.length]} fillOpacity={0.12} />
        ))}
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Tooltip contentStyle={tip} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function AreaTreemap({ data }: { data: MarketData["area_treemap"] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <Treemap
        data={data.map((d, i) => ({ name: d.location, size: d.count, fill: C[i % C.length] }))}
        dataKey="size"
        stroke="#0a0f1e"
        aspectRatio={4 / 3}
      >
        <Tooltip contentStyle={tip} />
      </Treemap>
    </ResponsiveContainer>
  );
}
