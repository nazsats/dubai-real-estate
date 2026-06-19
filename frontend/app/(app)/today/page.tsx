"use client";

import { useEffect, useState } from "react";
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
import { api, BriefingData, BriefingLead } from "@/lib/api";
import { aed } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import FollowUpFlow from "@/components/today/FollowUpFlow";

export default function TodayPage() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<{ name: string; message: string; busy: boolean } | null>(null);

  useEffect(() => {
    api.get<BriefingData>("/api/briefing/today").then(setData).catch((e) => setError(e.message));
  }, []);

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

  if (error) return <p className="text-red-300">Failed to load briefing: {error}</p>;
  if (!data)
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );

  const s = data.stats;
  const stats = [
    { label: "Follow-ups due", value: s.follow_ups, icon: BellRing, accent: "from-brand to-brand-600" },
    { label: "Hot leads", value: s.hot, icon: Flame, accent: "from-orange-400 to-red-600" },
    { label: "Going cold", value: s.going_cold, icon: Snowflake, accent: "from-sky-300 to-blue-600" },
    { label: "Tasks today", value: s.tasks_today, icon: CheckSquare, accent: "from-purple-400 to-fuchsia-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Today</h1>
        <p className="text-sm text-slate-400">
          Your AI sales manager — exactly who to act on, so no lead goes cold.
        </p>
      </div>

      <FollowUpFlow />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((st, i) => (
          <motion.div
            key={st.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="glass p-4"
          >
            <div className={`mb-3 inline-flex rounded-xl bg-gradient-to-br ${st.accent} p-2 shadow-glow`}>
              <st.icon className="h-5 w-5 text-white" />
            </div>
            <div className="text-2xl font-bold">{st.value}</div>
            <div className="text-xs text-slate-400">{st.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Follow-ups due */}
        <Section title="Follow-ups due" icon={BellRing} empty="All caught up — no follow-ups due 🎉">
          {data.follow_ups.map((l) => (
            <div key={l.lead_id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{l.name}</span>
                  <Badge variant="muted">{l.status}</Badge>
                  {l.score > 0 && <Badge>{l.score}°</Badge>}
                </div>
                <div className="text-xs text-amber-300/90">{l.reason}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => makeDraft(l)}>
                <Sparkles className="h-3.5 w-3.5" /> Draft
              </Button>
              <Link href={`/leads/${l.lead_id}`}>
                <Button size="sm" variant="ghost">
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ))}
        </Section>

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

      {/* AI draft modal */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass w-full max-w-lg p-6"
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
