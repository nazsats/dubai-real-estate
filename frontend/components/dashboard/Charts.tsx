"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardData } from "@/lib/api";
import { aed, num } from "@/lib/format";
import { useChartAnimation } from "@/lib/use-chart-animation";
import { useIsMobile } from "@/lib/use-breakpoint";
import {
  INK,
  SERIES_1,
  STAGE_COLOR,
  VIZ_SURFACE,
  axisTick,
  tooltipItemStyle,
  tooltipLabelStyle,
  tooltipStyle,
} from "@/lib/viz";

/** Shown instead of a chart when there's genuinely nothing to plot. */
function NoData({ hint }: { hint: string }) {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center gap-1 text-center">
      <p className="text-sm text-slate-400">No data yet</p>
      <p className="max-w-[220px] text-xs text-slate-500">{hint}</p>
    </div>
  );
}

/**
 * New leads over time. One series → one colour, no legend (the card title
 * names it). Hairline grid, recessive axes.
 */
export function LeadsOverTime({ data }: { data: DashboardData["leads_over_time"] }) {
  const animate = useChartAnimation();
  if (!data.length) return <NoData hint="Leads you add will appear here as a 30-day trend." />;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES_1} stopOpacity={0.35} />
            <stop offset="100%" stopColor={SERIES_1} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={INK.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: INK.axis }}
          tickFormatter={(d) => String(d).slice(5)}
        />
        <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={46} />
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          cursor={{ stroke: INK.axis, strokeWidth: 1 }}
          formatter={(v: number) => [`${v} new`, "Leads"]}
        />
        <Area
          isAnimationActive={animate}
          type="monotone"
          dataKey="count"
          stroke={SERIES_1}
          strokeWidth={2}
          fill="url(#leadGrad)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: VIZ_SURFACE }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * Average price by area. This is ONE measure across many areas, so every bar
 * is the same colour — previously each bar got a different hue, which encoded
 * nothing and burned the colour channel. Sorted so rank is read from position.
 */
export function AvgPriceByArea({ data }: { data: DashboardData["avg_price_by_area"] }) {
  const animate = useChartAnimation();
  const mobile = useIsMobile();
  if (!data.length) return <NoData hint="Import or add listings to see pricing by area." />;

  const top = [...data].sort((a, b) => b.avg_price - a.avg_price).slice(0, 8);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={top} layout="vertical" margin={{ left: 8, right: 46, top: 4, bottom: 4 }}>
        <CartesianGrid stroke={INK.grid} horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="location"
          width={mobile ? 82 : 116}
          tick={{ ...axisTick, fill: INK.secondary }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          formatter={(v: number, _n, p) => [
            `${aed(v, false)} · ${num(p.payload.count)} listings`,
            "Average price",
          ]}
        />
        <Bar
          isAnimationActive={animate}
          dataKey="avg_price"
          fill={SERIES_1}
          radius={[0, 4, 4, 0]}
          barSize={14}
        >
          {/* Direct labels: readable without hovering. The "AED " prefix is
              dropped because this card sits in a narrow 3-up grid, where the
              full string wraps onto two lines and collides with the bars —
              the card title already establishes the unit. */}
          <LabelList
            dataKey="avg_price"
            position="right"
            formatter={(v: number) => aed(v).replace("AED ", "")}
            style={{ fill: INK.muted, fontSize: 11 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Inventory by property type.
 *
 * Was a donut. Two reasons it isn't any more: a donut comparing close values
 * is hard to read, and with 4 types the categorical slots put yellow beside
 * orange — ΔE 4.8 under deuteranopia, effectively the same colour. A sorted
 * single-colour bar makes the comparison exact and needs no colour key at all.
 */
export function PropertyTypeBars({ data }: { data: DashboardData["properties_by_type"] }) {
  const animate = useChartAnimation();
  const mobile = useIsMobile();
  if (!data.length) return <NoData hint="Your listing mix will show here once you add inventory." />;

  const sorted = [...data].sort((a, b) => b.count - a.count);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={sorted} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
        <CartesianGrid stroke={INK.grid} horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="type"
          width={mobile ? 76 : 92}
          tick={{ ...axisTick, fill: INK.secondary }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          formatter={(v: number) => [`${num(v)} listings`, "Inventory"]}
        />
        <Bar
          isAnimationActive={animate}
          dataKey="count"
          fill={SERIES_1}
          radius={[0, 4, 4, 0]}
          barSize={14}
        >
          <LabelList
            dataKey="count"
            position="right"
            formatter={(v: number) => num(v)}
            style={{ fill: INK.muted, fontSize: 11 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Leads by pipeline stage. These categories ARE ordered, so they get the
 * ordinal ramp (deepening as the lead progresses) rather than arbitrary hues.
 * Won/Lost take reserved status colours — and because green vs red is ΔE 4.1
 * under deuteranopia, the stage name on the axis is what actually carries the
 * meaning. Colour only reinforces it.
 */
export function LeadsByStageBar({ data }: { data: DashboardData["leads_by_stage"] }) {
  const animate = useChartAnimation();
  if (!data.length) return <NoData hint="Add leads to see how your pipeline is distributed." />;

  const ORDER = ["New", "Contacted", "Qualified", "Viewing", "Negotiation", "Won", "Lost"];
  const sorted = [...data].sort((a, b) => ORDER.indexOf(a.stage) - ORDER.indexOf(b.stage));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={sorted} margin={{ top: 16, left: 0, right: 8, bottom: 4 }}>
        <CartesianGrid stroke={INK.grid} vertical={false} />
        <XAxis
          dataKey="stage"
          tick={{ ...axisTick, fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: INK.axis }}
          interval={0}
          angle={-20}
          dy={10}
          height={48}
        />
        <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={46} />
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          formatter={(v: number) => [`${num(v)} leads`, "In stage"]}
        />
        <Bar isAnimationActive={animate} dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {sorted.map((d) => (
            <Cell key={d.stage} fill={STAGE_COLOR[d.stage] ?? SERIES_1} />
          ))}
          <LabelList
            dataKey="count"
            position="top"
            formatter={(v: number) => (v > 0 ? num(v) : "")}
            style={{ fill: INK.muted, fontSize: 11 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
