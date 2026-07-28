"use client";

import { useReducedMotion } from "framer-motion";

/**
 * Whether Recharts marks should animate in.
 *
 * Recharts animations are JavaScript-driven, so the `prefers-reduced-motion`
 * CSS block in globals.css does not reach them — a reader who asked the OS to
 * stop motion would still get every bar sweeping up on each load. This hook
 * closes that gap, and as a side benefit makes charts render deterministically
 * for screenshots and tests.
 */
export function useChartAnimation(): boolean {
  return !useReducedMotion();
}
