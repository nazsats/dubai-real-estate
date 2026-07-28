"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, Cpu, ListChecks, Send, History, TrendingUp, ChevronDown, Info } from "lucide-react";

const STEPS = [
  { icon: Clock, title: "Lead goes quiet", desc: "No reply for a few days" },
  { icon: Cpu, title: "Engine flags it", desc: "Rules only — 0 AI cost" },
  { icon: ListChecks, title: "Shows on Today", desc: "Your action list" },
  { icon: Send, title: "You act", desc: "Call · WhatsApp · AI draft" },
  { icon: History, title: "Logged", desc: "Saved to timeline" },
  { icon: TrendingUp, title: "Lead re-warms", desc: "Closer to a deal" },
];

export default function FollowUpFlow() {
  // Collapsed by default: it's an explainer, not the day's work.
  const [open, setOpen] = useState(false);

  return (
    <div className="glass overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 font-semibold">
          <Info className="h-4 w-4 text-brand" /> What is the Follow-up Engine?
        </span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="border-t border-white/10 px-5 pb-5 pt-4"
        >
          <p className="mb-5 max-w-3xl text-sm text-slate-400">
            Deals are usually lost to <b className="text-slate-200">slow follow-ups</b>, not bad selling —
            most need 5–8 touches before closing. This engine watches every lead and, the moment one
            goes quiet, surfaces it here with <b className="text-slate-200">who to contact and why</b>.
            It runs on simple rules (no AI tokens spent); AI is only used when you click
            <b className="text-slate-200"> “Draft”</b> to write the message for you.
          </p>

          {/* Flowchart */}
          <div className="flex flex-wrap items-stretch gap-2">
            {STEPS.map((s, i) => (
              <div key={s.title} className="flex items-stretch gap-2">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="flex w-36 flex-col rounded-xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <div className="mb-2 inline-flex w-fit rounded-lg bg-gradient-to-br from-brand/20 to-brand-600/20 p-2 ring-1 ring-brand/20">
                    <s.icon className="h-4 w-4 text-brand" />
                  </div>
                  <div className="text-xs font-semibold">{s.title}</div>
                  <div className="text-[11px] text-slate-400">{s.desc}</div>
                </motion.div>
                {i < STEPS.length - 1 && (
                  <div className="hidden items-center text-slate-600 sm:flex">→</div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
