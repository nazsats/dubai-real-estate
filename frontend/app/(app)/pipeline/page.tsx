"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Plus } from "lucide-react";
import { api, Lead, PipelineData } from "@/lib/api";
import { aed } from "@/lib/format";

const STAGE_COLOR: Record<string, string> = {
  New: "#00c6ff",
  Contacted: "#0072ff",
  Qualified: "#a855f7",
  Viewing: "#f97316",
  Negotiation: "#d4af37",
  Won: "#22c55e",
  Lost: "#ef4444",
};

export default function PipelinePage() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");

  async function load() {
    setData(await api.get<PipelineData>("/api/pipeline"));
  }
  useEffect(() => {
    load();
  }, []);

  async function addLead(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await api.post("/api/leads", { name, budget_max: budget ? Number(budget) : null });
    setName("");
    setBudget("");
    setAdding(false);
    load();
  }

  async function moveLead(lead: Lead, stage: string) {
    await api.patch(`/api/leads/${lead.id}`, { status: stage });
    load();
  }

  if (!data)
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pipeline</h1>
          <p className="text-sm text-slate-400">Track every lead from first contact to closed deal.</p>
        </div>
        <button
          onClick={() => setAdding(!adding)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> Add lead
        </button>
      </div>

      {adding && (
        <form onSubmit={addLead} className="glass flex flex-wrap items-end gap-3 p-4">
          <label className="flex-1">
            <span className="mb-1 block text-xs text-slate-400">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-ink-700/60 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs text-slate-400">Max budget (AED)</span>
            <input
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              type="number"
              className="rounded-lg border border-white/10 bg-ink-700/60 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Save</button>
        </form>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {data.stages.map((stage) => (
          <div key={stage} className="w-72 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: STAGE_COLOR[stage] }} />
                {stage}
              </span>
              <span className="text-xs text-slate-500">{data.counts[stage] ?? 0}</span>
            </div>
            <div className="space-y-2">
              {(data.board[stage] ?? []).map((lead) => (
                <motion.div
                  key={lead.id}
                  layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{lead.name}</span>
                    {lead.score > 0 && (
                      <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] text-brand">
                        {lead.score}°
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {lead.budget_max ? `up to ${aed(lead.budget_max)}` : "budget open"}
                    {lead.bedrooms ? ` · ${lead.bedrooms}BR` : ""}
                  </div>
                  <select
                    value={lead.status}
                    onChange={(e) => moveLead(lead, e.target.value)}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-ink-700/60 px-2 py-1 text-xs outline-none focus:border-brand"
                  >
                    {data.stages.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </motion.div>
              ))}
              {(data.board[stage] ?? []).length === 0 && (
                <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-600">
                  Empty
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
