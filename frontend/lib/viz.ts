/**
 * Data-visualisation colour tokens.
 *
 * Every value here was validated against this app's actual chart surface
 * (#15161b — the glass card's white/0.025 over ink-900) for the dark band,
 * CVD separation, chroma floor and contrast. Do not hand-edit a hex without
 * re-validating: the point of this file is that colour choices are computed,
 * not eyeballed.
 *
 * Three separate jobs, three separate scales — never mix them:
 *   SERIES   identity  (which category is this?)
 *   STAGE    order     (how far along the funnel?)
 *   STATUS   state     (is this good or bad?)
 */

/** The chart surface these tokens were validated against. */
export const VIZ_SURFACE = "#15161b";

/**
 * Categorical slots, in fixed order. Assign by slot index and never cycle —
 * a 9th category folds into "Other" instead of inventing a hue.
 *
 * Capped at 3 for all-pairs forms (donut, scatter, choropleth) where every
 * mark is visually adjacent to every other: slots 4+ put yellow beside orange,
 * which measures ΔE 4.8 under deuteranopia.
 */
export const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500"] as const;
export const SERIES_ALL_PAIRS_CAP = 3;

/** The single hue used whenever a chart shows ONE measure. */
export const SERIES_1 = SERIES[0];

/**
 * Ordinal ramp for the pipeline funnel — light→dark as a lead progresses.
 * Validated with --ordinal: monotone lightness, all adjacent gaps >= 0.06,
 * light end clears the surface at 2.74:1.
 */
export const STAGE_RAMP = ["#cde2fb", "#9ec5f4", "#5598e7", "#2a78d6", "#1c5cab"] as const;

/**
 * 6-step ordinal ramp, for ordered bins with one more class than STAGE_RAMP
 * (price bands). Also validated with --ordinal; the light end is spaced wider
 * than a naive 100/150/200 selection, which failed the adjacent-ΔL gate.
 */
export const BAND_RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95"] as const;

/** Pick `n` evenly-spaced steps from an ordinal ramp. */
export function rampSteps(ramp: readonly string[], n: number): string[] {
  if (n <= 1) return [ramp[ramp.length - 1]];
  if (n >= ramp.length) return [...ramp];
  return Array.from({ length: n }, (_, i) =>
    ramp[Math.round((i * (ramp.length - 1)) / (n - 1))]
  );
}

/**
 * Reserved status colours. Never reused as a series colour.
 *
 * good vs critical measure ΔE 4.1 under deuteranopia — indistinguishable for
 * red-green colourblind readers. They are therefore ALWAYS paired with an icon
 * and a text label; colour never carries the meaning alone.
 */
export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

/** Chart chrome — recessive by design. */
export const INK = {
  primary: "#f1f5f9",
  secondary: "#cbd5e1",
  muted: "#94a3b8",
  grid: "rgba(255,255,255,0.06)",
  axis: "rgba(255,255,255,0.12)",
} as const;

/**
 * Pipeline stage → colour. Active stages deepen along the ordinal ramp;
 * terminal outcomes take status colours.
 *
 * Callers MUST render the stage name (and ideally an icon) alongside the
 * colour — see the note on STATUS above.
 */
export const STAGE_COLOR: Record<string, string> = {
  New: STAGE_RAMP[0],
  Contacted: STAGE_RAMP[1],
  Qualified: STAGE_RAMP[2],
  Viewing: STAGE_RAMP[3],
  Negotiation: STAGE_RAMP[4],
  Won: STATUS.good,
  Lost: STATUS.critical,
};

/** Shared Recharts tooltip styling. */
export const tooltipStyle = {
  background: "#1b1d24",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  color: INK.primary,
  fontSize: 12,
  padding: "8px 12px",
  boxShadow: "0 16px 40px -20px rgba(0,0,0,0.9)",
} as const;

export const tooltipItemStyle = { color: INK.secondary } as const;
export const tooltipLabelStyle = { color: INK.primary, fontWeight: 600, marginBottom: 2 } as const;

/** Recessive axis tick styling, shared by every chart. */
export const axisTick = { fill: INK.muted, fontSize: 11 } as const;
