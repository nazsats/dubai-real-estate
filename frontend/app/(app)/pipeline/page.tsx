"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, Plus, ArrowUpRight } from "lucide-react";
import { api, Lead, PipelineData } from "@/lib/api";
import { aed, num } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STAGE_COLOR: Record<string, string> = {
  New: "#2dd4ff",
  Contacted: "#38bdf8",
  Qualified: "#6366f1",
  Viewing: "#f59e0b",
  Negotiation: "#e3b341",
  Won: "#34d399",
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

  const total = Object.values(data.counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pipeline</h1>
          <p className="text-sm text-slate-400">
            {num(total)} leads · first contact to closed deal.
          </p>
        </div>
        <Button onClick={() => setAdding(!adding)}>
          <Plus className="h-4 w-4" /> Add lead
        </Button>
      </div>

      {adding && (
        <form onSubmit={addLead} className="glass flex flex-wrap items-end gap-3 p-4">
          <label className="flex-1">
            <span className="mb-1 block text-xs text-slate-400">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lead name" />
          </label>
          <label>
            <span className="mb-1 block text-xs text-slate-400">Max budget (AED)</span>
            <Input value={budget} onChange={(e) => setBudget(e.target.value)} type="number" className="w-44" />
          </label>
          <Button type="submit">Save</Button>
        </form>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {data.stages.map((stage) => {
          const shown = data.board[stage] ?? [];
          const count = data.counts[stage] ?? 0;
          const more = count - shown.length;
          return (
            <div key={stage} className="flex w-72 shrink-0 flex-col">
              <div
                className="mb-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                style={{ borderTopColor: STAGE_COLOR[stage], borderTopWidth: 2 }}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: STAGE_COLOR[stage] }} />
                  {stage}
                </span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-300">{num(count)}</span>
              </div>

              <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1">
                {shown.map((lead) => (
                  <motion.div
                    key={lead.id}
                    layout
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass p-3"
                  >
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="flex items-center gap-1 font-medium hover:text-brand"
                      >
                        {lead.name}
                        <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
                      </Link>
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

                {shown.length === 0 && (
                  <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-600">
                    Empty
                  </div>
                )}

                {more > 0 && (
                  <div className="rounded-xl border border-dashed border-white/10 py-2 text-center text-xs text-slate-500">
                    +{num(more)} more in {stage}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
