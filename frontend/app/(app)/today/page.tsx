"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Loader2,
  BellRing,
  Flame,
  Snowflake,
  CheckSquare,
  Sparkles,
  ArrowUpRight,
  Copy,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { api, BriefingData, BriefingLead } from "@/lib/api";
import { aed } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { ListSkeleton, Skeleton, StatRowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import FollowUpFlow from "@/components/today/FollowUpFlow";

export default function TodayPage() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<{ name: string; message: string; busy: boolean } | null>(null);

  const load = useCallback(() => {
    setError("");
    api.get<BriefingData>("/api/briefing/today").then(setData).catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  async function makeDraft(lead: BriefingLead) {
    setDraft({ name: lead.name, message: "", busy: true });
    try {
      const res = await api.post<{ message: string }>("/api/ai/followup", {
        lead_id: lead.lead_id,
        channel: "whatsapp",
      });
      setDraft({ name: lead.name, message: res.message, busy: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Draft failed");
      setDraft(null);
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;

  if (!data)
    return (
      <div className="space-y-6">
        <TodayHeader />
        <StatRowSkeleton />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass space-y-2 p-4">
              <Skeleton className="mb-3 h-4 w-32" />
              <ListSkeleton rows={3} />
            </div>
          ))}
        </div>
      </div>
    );

  const s = data.stats;

  // Nothing to act on yet — say so plainly rather than showing four zeros.
  if (s.active_leads === 0)
    return (
      <div className="space-y-6">
        <TodayHeader />
        <div className="glass">
          <EmptyState
            icon={UserPlus}
            title="Nothing to chase yet"
            description="Once you have active leads, this page tells you exactly who to contact today — who's gone quiet, who's hot, and what's due. It's the first page to open each morning."
            actionLabel="Add your first lead"
            actionHref="/pipeline"
          />
        </div>
      </div>
    );
  return (
    <div className="space-y-6">
      <TodayHeader />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          index={0}
          label="Follow-ups due"
          value={String(s.follow_ups)}
          caption="Leads waiting longer than they should"
          icon={BellRing}
          tone={s.follow_ups > 0 ? "brand" : "neutral"}
        />
        <StatTile index={1} label="Hot leads" value={String(s.hot)} caption="Highest scoring and still open" icon={Flame} />
        <StatTile
          index={2}
          label="Going cold"
          value={String(s.going_cold)}
          caption="No contact for 7 days or more"
          icon={Snowflake}
        />
        <StatTile
          index={3}
          label="Tasks today"
          value={String(s.tasks_today)}
          caption="Due today or already overdue"
          icon={CheckSquare}
          tone={s.tasks_today > 0 ? "brand" : "neutral"}
        />
      </div>

      {/* THE action list — full width, numbered, most-overdue first. This is
          the reason the page exists, so it comes before everything else. */}
      <div className="glass p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <BellRing className="h-4 w-4 text-brand" /> Contact these people today
          </h3>
          <span className="text-xs text-slate-500">most overdue first</span>
        </div>
        {data.follow_ups.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">
            All caught up — no follow-ups due 🎉
          </p>
        ) : (
          <div className="space-y-2">
            {data.follow_ups.map((l, i) => {
              // Urgency is carried by text + position, colour just reinforces.
              const urgent = (l.days_since_touch ?? 0) >= 7;
              return (
                <div
                  key={l.lead_id}
                  // Stacks on phones so the name and reason get full width and
                  // the buttons keep a usable tap target instead of squeezing.
                  className="flex flex-col gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3 sm:flex-row sm:items-center sm:gap-3"
                >
                  <span className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-xs font-bold text-slate-400 sm:flex">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{l.name}</span>
                      <Badge variant="muted">{l.status}</Badge>
                      {l.score > 0 && <Badge>{l.score}°</Badge>}
                      {l.budget_max ? (
                        <span className="text-xs text-slate-500">up to {aed(l.budget_max)}</span>
                      ) : null}
                    </div>
                    <div className={`mt-0.5 text-xs ${urgent ? "text-red-300" : "text-amber-300/90"}`}>
                      {l.reason}
                      {urgent && " — at risk of going cold"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => makeDraft(l)}>
                      <Sparkles className="h-3.5 w-3.5" /> Draft
                    </Button>
                    <Link href={`/leads/${l.lead_id}`} className="ml-auto sm:ml-0">
                      <Button size="sm" variant="ghost">
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Hot leads */}
        <Section title="Hot leads" icon={Flame} empty="No scored leads yet.">
          {data.hot_leads.map((l) => (
            <LeadRow key={l.lead_id} l={l} note={l.budget_max ? `up to ${aed(l.budget_max)}` : "budget open"} />
          ))}
        </Section>

        {/* Going cold */}
        <Section title="Going cold (7+ days)" icon={Snowflake} empty="Nothing going cold.">
          {data.going_cold.map((l) => (
            <LeadRow key={l.lead_id} l={l} note={l.reason} danger />
          ))}
        </Section>

        {/* Tasks today */}
        <Section title="Tasks due today" icon={CheckSquare} empty="No tasks due today.">
          {data.tasks_today.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div>
                <div className="text-sm font-medium">{t.title}</div>
                {t.due_at && (
                  <div className={`text-xs ${t.overdue ? "text-red-300" : "text-slate-400"}`}>
                    {t.overdue ? "Overdue · " : ""}
                    {new Date(t.due_at).toLocaleString()}
                  </div>
                )}
              </div>
              {t.lead_id && (
                <Link href={`/leads/${t.lead_id}`}>
                  <Button size="sm" variant="ghost">
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          ))}
        </Section>
      </div>

      {/* How the engine works — reference material, so it lives last and
          starts collapsed instead of pushing the action list below the fold. */}
      <FollowUpFlow />

      {/* AI draft modal */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass max-h-[85vh] w-full max-w-lg overflow-y-auto p-4 sm:p-6"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-bold">
                <Sparkles className="h-5 w-5 text-brand" /> Follow-up for {draft.name}
              </h3>
              <button onClick={() => setDraft(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            {draft.busy ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-brand" />
              </div>
            ) : (
              <>
                <p className="whitespace-pre-wrap rounded-xl bg-white/[0.03] p-4 text-sm text-slate-100">
                  {draft.message}
                </p>
                <div className="mt-3 flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(draft.message);
                      toast.success("Copied");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}

function TodayHeader() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-50">Today</h1>
      <p className="mt-0.5 text-sm text-slate-400">
        Your AI sales manager — exactly who to act on, so no lead goes cold.
      </p>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  empty,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.some(Boolean) && items.length > 0;
  return (
    <div className="glass p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300">
        <Icon className="h-4 w-4 text-brand" /> {title}
      </h3>
      <div className="space-y-2">{hasItems ? children : <p className="text-xs text-slate-500">{empty}</p>}</div>
    </div>
  );
}

function LeadRow({ l, note, danger }: { l: BriefingLead; note?: string | null; danger?: boolean }) {
  return (
    <Link
      href={`/leads/${l.lead_id}`}
      className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:border-brand/30"
    >
      <div className="flex items-center gap-2">
        <span className="font-medium">{l.name}</span>
        <Badge variant="muted">{l.status}</Badge>
        {l.score > 0 && <Badge>{l.score}°</Badge>}
      </div>
      <span className={`text-xs ${danger ? "text-sky-300" : "text-slate-400"}`}>{note}</span>
    </Link>
  );
}
