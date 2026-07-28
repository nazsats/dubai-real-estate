"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, ArrowUpRight, Trophy, XCircle, UserPlus } from "lucide-react";
import { api, Lead, PipelineData } from "@/lib/api";
import { aed, num } from "@/lib/format";
import { STAGE_COLOR } from "@/lib/viz";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Won and Lost use the reserved status colours, which are green and red —
 * a pair that measures ΔE 4.1 under deuteranopia, i.e. effectively identical
 * for red-green colourblind readers. An icon on each makes the outcome
 * readable without relying on hue.
 */
const STAGE_ICON: Record<string, typeof Trophy> = { Won: Trophy, Lost: XCircle };

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
      <div className="space-y-5">
        <Skeleton className="h-9 w-48" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );

  const total = Object.values(data.counts).reduce((a, b) => a + b, 0);

  // A brand-new agency sees an entire board of empty columns, which explains
  // nothing. Show them the one action that gets them started instead.
  if (total === 0 && !adding)
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50">Pipeline</h1>
          <p className="mt-0.5 text-sm text-slate-400">Track every lead from first contact to closed deal.</p>
        </div>
        <div className="glass">
          <EmptyState
            icon={UserPlus}
            title="No leads yet"
            description="Add your first lead and it'll appear here. As you work them, drag them through the stages from New to Won — the Today page will then tell you who needs chasing."
            actionLabel="Add your first lead"
            onAction={() => setAdding(true)}
          />
        </div>
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50">Pipeline</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            {num(total)} {total === 1 ? "lead" : "leads"} · first contact to closed deal.
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

      {/* A wrapping grid, not a horizontal scroller: Won and Lost used to sit
          off-screen to the right, so closing stages were effectively invisible.
          Columns now wrap onto a second row on smaller screens and all seven
          fit side-by-side on wide ones. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
        {data.stages.map((stage) => {
          const shown = data.board[stage] ?? [];
          const count = data.counts[stage] ?? 0;
          const more = count - shown.length;
          const Icon = STAGE_ICON[stage];
          return (
            <div key={stage} className="flex min-w-0 flex-col">
              <div
                className="mb-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                style={{ borderTopColor: STAGE_COLOR[stage], borderTopWidth: 2 }}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                  {Icon ? (
                    <Icon className="h-3.5 w-3.5" style={{ color: STAGE_COLOR[stage] }} />
                  ) : (
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: STAGE_COLOR[stage] }}
                    />
                  )}
                  {stage}
                </span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs tabular-nums text-slate-300">
                  {num(count)}
                </span>
              </div>

              <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                {shown.map((lead) => (
                  <motion.div
                    key={lead.id}
                    layout
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass p-3"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="flex min-w-0 items-center gap-1 text-sm font-medium hover:text-brand"
                      >
                        <span className="truncate">{lead.name}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
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
                  <div className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center">
                    <p className="text-xs text-slate-500">Nothing in {stage}</p>
                    <p className="mt-1 text-[11px] leading-snug text-slate-600">
                      Move a lead here using the dropdown on its card.
                    </p>
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
