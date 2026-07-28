"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Scatter,
  ScatterChart,
  Treemap,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  Legend,
} from "recharts";
import { MarketData } from "@/lib/api";
import { aed, num } from "@/lib/format";
import { useChartAnimation } from "@/lib/use-chart-animation";
import { useIsMobile } from "@/lib/use-breakpoint";
import {
  BAND_RAMP,
  INK,
  SERIES,
  SERIES_1,
  SERIES_ALL_PAIRS_CAP,
  VIZ_SURFACE,
  axisTick,
  rampSteps,
  tooltipItemStyle,
  tooltipLabelStyle,
  tooltipStyle,
} from "@/lib/viz";

const legendStyle = { fontSize: 11, color: INK.secondary } as const;

function Tip(props: Record<string, unknown>) {
  return (
    <Tooltip
      contentStyle={tooltipStyle}
      itemStyle={tooltipItemStyle}
      labelStyle={tooltipLabelStyle}
      cursor={{ fill: "rgba(255,255,255,0.04)" }}
      {...props}
    />
  );
}

/** Price bands are ORDERED bins, so they take the ordinal ramp rather than
 *  the rainbow this used to cycle through. Depth now means "more expensive". */
export function PriceBands({ data }: { data: MarketData["price_bands"] }) {
  const animate = useChartAnimation();
  const steps = rampSteps(BAND_RAMP, data.length);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: 0, top: 16, right: 8 }}>
        <CartesianGrid stroke={INK.grid} vertical={false} />
        <XAxis dataKey="band" tick={axisTick} tickLine={false} axisLine={{ stroke: INK.axis }} />
        <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={46} />
        <Tip formatter={(v: number) => [`${num(v)} listings`, "Count"]} />
        <Bar isAnimationActive={animate} dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {data.map((d, i) => (
            <Cell key={d.band} fill={steps[i]} />
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

/** One measure across ordered bedroom counts → one colour. */
export function BedroomsDist({ data }: { data: MarketData["bedrooms_dist"] }) {
  const animate = useChartAnimation();
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: 0, top: 16, right: 8 }}>
        <CartesianGrid stroke={INK.grid} vertical={false} />
        <XAxis dataKey="beds" tick={axisTick} tickLine={false} axisLine={{ stroke: INK.axis }} />
        <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={46} />
        <Tip formatter={(v: number) => [`${num(v)} listings`, "Count"]} />
        <Bar
          isAnimationActive={animate}
          dataKey="count"
          radius={[4, 4, 0, 0]}
          fill={SERIES_1}
          maxBarSize={48}
        >
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

/**
 * Property type mix. Was a donut; a donut can't be compared precisely and with
 * 4+ types the categorical slots collide under colour-vision deficiency. A
 * sorted single-colour bar answers "which type do I have most of" exactly.
 */
export function TypeMixBars({ data }: { data: MarketData["type_mix"] }) {
  const animate = useChartAnimation();
  const mobile = useIsMobile();
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
        <Tip formatter={(v: number) => [`${num(v)} listings`, "Count"]} />
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
 * Ready vs off-plan. Two values — a radial gauge was overkill and hard to read
 * precisely. A labelled split bar shows the ratio and both numbers at once.
 */
export function ReadySplit({ data }: { data: MarketData["ready_split"] }) {
  const total = data.reduce((a, b) => a + b.count, 0) || 1;
  const colors = [SERIES[0], SERIES[1]];

  return (
    <div className="flex h-[240px] flex-col justify-center gap-4 px-1">
      <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full">
        {data.map((d, i) => (
          <div
            key={d.status}
            style={{ width: `${(d.count / total) * 100}%`, background: colors[i] }}
            title={`${d.status}: ${num(d.count)}`}
          />
        ))}
      </div>
      <div className="space-y-2.5">
        {data.map((d, i) => (
          <div key={d.status} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[i] }} />
              {d.status}
            </span>
            <span className="tabular-nums text-slate-400">
              {num(d.count)}
              <span className="ml-2 text-xs text-slate-500">
                {((d.count / total) * 100).toFixed(0)}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Asking-price range per property type.
 *
 * Built as a true floating range bar: a transparent bar up to `min` carries a
 * visible bar spanning `min`→`max`, with the average marked as an unconnected
 * dot. Two things were wrong with the previous version — a line joined
 * Apartment→Villa→Townhouse→Penthouse, implying a trend across categories that
 * have no order, and min/max were drawn as separate same-hue bars at different
 * opacity, which read as two unrelated measures rather than the ends of one
 * range.
 */
export function PriceRangeByType({ data }: { data: MarketData["price_range_by_type"] }) {
  const animate = useChartAnimation();
  const mobile = useIsMobile();
  const rows = data.map((d) => ({ ...d, base: d.min, span: Math.max(0, d.max - d.min) }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart
        data={rows}
        layout="vertical"
        margin={{ left: 8, top: 8, right: 16, bottom: 4 }}
      >
        <CartesianGrid stroke={INK.grid} horizontal={false} />
        <XAxis
          type="number"
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: INK.axis }}
          tickFormatter={(v) => aed(v)}
        />
        <YAxis
          type="category"
          dataKey="type"
          width={mobile ? 74 : 86}
          tick={{ ...axisTick, fill: INK.secondary }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          formatter={(_v, name, p) => {
            if (name === "Average") return [aed(p.payload.avg, false), "Average"];
            return [`${aed(p.payload.min, false)} – ${aed(p.payload.max, false)}`, "Range"];
          }}
        />
        <Legend wrapperStyle={legendStyle} iconSize={9} />
        {/* Invisible spacer that offsets the visible bar to start at `min`. */}
        <Bar dataKey="base" stackId="range" fill="transparent" isAnimationActive={false} legendType="none" />
        <Bar
          isAnimationActive={animate}
          dataKey="span"
          stackId="range"
          fill={SERIES[0]}
          radius={4}
          barSize={14}
          name="Lowest to highest"
        />
        {/* Unconnected marker — an average per category, not a trend between them. */}
        <Scatter
          isAnimationActive={animate}
          dataKey="avg"
          fill={SERIES[1]}
          name="Average"
          shape="circle"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** One measure across areas → one colour, sorted, directly labelled. */
export function PpsfByArea({ data }: { data: MarketData["ppsf_by_area"] }) {
  const animate = useChartAnimation();
  const mobile = useIsMobile();
  const top = [...data].sort((a, b) => b.ppsf - a.ppsf).slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={top} layout="vertical" margin={{ left: 8, right: 64, top: 4, bottom: 4 }}>
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
        <Tip formatter={(v: number) => [`AED ${num(Math.round(v))}/sqft`, "Price per sqft"]} />
        <Bar
          isAnimationActive={animate}
          dataKey="ppsf"
          fill={SERIES_1}
          radius={[0, 4, 4, 0]}
          barSize={14}
        >
          <LabelList
            dataKey="ppsf"
            position="right"
            formatter={(v: number) => num(Math.round(v))}
            style={{ fill: INK.muted, fontSize: 11 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Size vs price. One population → one colour; surface ring on overlap. */
export function SizeVsPrice({ data }: { data: MarketData["scatter"] }) {
  const animate = useChartAnimation();
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart margin={{ left: 6, top: 8, right: 12 }}>
        <CartesianGrid stroke={INK.grid} />
        <XAxis
          type="number"
          dataKey="size"
          name="Size"
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: INK.axis }}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          unit=" sqft"
        />
        <YAxis
          type="number"
          dataKey="price"
          name="Price"
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => aed(v)}
          width={62}
        />
        <ZAxis range={[36, 36]} />
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          cursor={{ stroke: INK.axis }}
          formatter={(v: number, name: string) =>
            name === "Price" ? aed(v, false) : `${num(v)} sqft`
          }
        />
        <Scatter
          isAnimationActive={animate}
          data={data}
          fill={SERIES_1}
          fillOpacity={0.45}
          stroke={VIZ_SURFACE}
          strokeWidth={1}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/**
 * Area comparison radar.
 *
 * Capped at 3 areas. This previously drew 5 overlapping series cycling a
 * rainbow — on an all-pairs form like radar, where every series sits beside
 * every other, more than 3 hues cannot stay distinguishable under CVD, and 5
 * translucent overlapping shapes are unreadable regardless of colour.
 */
export function AreaRadar({ radar }: { radar: MarketData["radar"] }) {
  const animate = useChartAnimation();
  const areas = radar.areas.slice(0, SERIES_ALL_PAIRS_CAP);
  return (
    <>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={radar.data} outerRadius={100}>
          <PolarGrid stroke={INK.grid} />
          <PolarAngleAxis dataKey="metric" tick={{ fill: INK.secondary, fontSize: 11 }} />
          {areas.map((area, i) => (
            <Radar
              isAnimationActive={animate}
              key={area}
              dataKey={area}
              stroke={SERIES[i]}
              fill={SERIES[i]}
              fillOpacity={0.1}
              strokeWidth={2}
            />
          ))}
          <Legend wrapperStyle={legendStyle} iconSize={9} />
          <Tooltip
            contentStyle={tooltipStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
          />
        </RadarChart>
      </ResponsiveContainer>
      {radar.areas.length > areas.length && (
        <p className="mt-1 text-center text-[11px] text-slate-500">
          Showing the top {areas.length} areas by inventory. Values are indexed to the highest in
          each metric.
        </p>
      )}
    </>
  );
}

/** Inventory by area — one measure, so a single-hue sequential ramp where
 *  depth tracks magnitude, not an arbitrary colour per tile. */
export function AreaTreemap({ data }: { data: MarketData["area_treemap"] }) {
  const animate = useChartAnimation();
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <Treemap
        isAnimationActive={animate}
        data={data.map((d) => ({
          name: d.location,
          size: d.count,
          // Larger inventory → deeper step of the single sequential hue.
          fill: BAND_RAMP[
            Math.min(BAND_RAMP.length - 1, Math.floor((d.count / max) * (BAND_RAMP.length - 1)))
          ],
        }))}
        dataKey="size"
        stroke={VIZ_SURFACE}
        aspectRatio={4 / 3}
      >
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          formatter={(v: number) => [`${num(v)} listings`, "Inventory"]}
        />
      </Treemap>
    </ResponsiveContainer>
  );
}
