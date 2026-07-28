"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

/**
 * A single headline number.
 *
 * Deliberately restrained: the value is the loudest thing in the tile, the
 * icon is a quiet marker, and the caption explains what the number MEANS —
 * "AED 12.4M" tells an agent nothing without "across 8 open deals".
 *
 * The previous tiles wrapped each icon in its own bright gradient (cyan,
 * green, purple, amber). Four unrelated hues competing at the top of the page
 * read as decoration and made the numbers harder to scan, so the accent is now
 * a single tint applied to the icon only.
 */
export function StatTile({
  label,
  value,
  caption,
  icon: Icon,
  tone = "neutral",
  index = 0,
}: {
  label: string;
  value: string;
  caption?: string;
  icon: LucideIcon;
  tone?: "neutral" | "brand" | "good";
  index?: number;
}) {
  const toneClass = {
    neutral: "bg-white/[0.05] text-slate-300 ring-white/10",
    brand: "bg-brand/10 text-brand ring-brand/25",
    good: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/25",
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="glass card-hover p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <span className={`rounded-lg p-1.5 ring-1 ${toneClass}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      {/* Proportional figures, not tabular — tabular-nums makes large standalone
          numbers look loose. */}
      <div className="mt-3 text-[26px] font-bold leading-none tracking-tight text-slate-50">
        {value}
      </div>
      {caption && <div className="mt-1.5 text-[11px] leading-snug text-slate-500">{caption}</div>}
    </motion.div>
  );
}
