"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  MessageSquare,
  Mail,
  Megaphone,
  Copy,
  Save,
  Phone,
  X,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { api, Interaction, Lead, Property } from "@/lib/api";
import { aed } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import PropertyCard from "@/components/PropertyCard";

const STAGES = ["New", "Contacted", "Qualified", "Viewing", "Negotiation", "Won", "Lost"];

interface MatchRes {
  analysis: string;
  properties: Property[];
}
interface PitchRes {
  channel: string;
  message: string;
  properties: Property[];
}
interface AiResult {
  kind: "match" | "pitch";
  analysis?: string;
  message?: string;
  channel?: string;
  properties: Property[];
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [timeline, setTimeline] = useState<Interaction[]>([]);
  const [note, setNote] = useState("");
  const [channel, setChannel] = useState("note");
  const [ai, setAi] = useState<AiResult | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [marketing, setMarketing] = useState<{ assets: Record<string, string>; busy: boolean } | null>(null);

  const loadTimeline = useCallback(async () => {
    setTimeline(await api.get<Interaction[]>(`/api/leads/${id}/interactions`));
  }, [id]);

  useEffect(() => {
    api.get<Lead>(`/api/leads/${id}`).then(setLead).catch(() => toast.error("Lead not found"));
    loadTimeline();
  }, [id, loadTimeline]);

  async function changeStatus(status: string) {
    const updated = await api.patch<Lead>(`/api/leads/${id}`, { status });
    setLead(updated);
    toast.success(`Moved to ${status}`);
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    await api.post(`/api/leads/${id}/interactions`, { channel, direction: "out", body: note });
    setNote("");
    loadTimeline();
  }

  async function runMatch() {
    setAiBusy("match");
    try {
      const res = await api.post<MatchRes>("/api/ai/match", { lead_id: Number(id) });
      setAi({ kind: "match", analysis: res.analysis, properties: res.properties });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Match failed");
    } finally {
      setAiBusy(null);
    }
  }

  async function runPitch(ch: "whatsapp" | "email") {
    setAiBusy(ch);
    try {
      const res = await api.post<PitchRes>("/api/ai/pitch", { lead_id: Number(id), channel: ch });
      setAi({ kind: "pitch", message: res.message, channel: res.channel, properties: res.properties });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pitch failed");
    } finally {
      setAiBusy(null);
    }
  }

  async function runMarketing(propertyId: number) {
    setMarketing({ assets: {}, busy: true });
    try {
      const res = await api.post<{ assets: Record<string, string> }>("/api/ai/marketing", {
        property_id: propertyId,
        channels: ["listing", "instagram", "ad"],
      });
      setMarketing({ assets: res.assets, busy: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Marketing failed");
      setMarketing(null);
    }
  }

  async function savePitch() {
    if (!ai?.message) return;
    await api.post(`/api/leads/${id}/interactions`, {
      channel: ai.channel,
      direction: "out",
      body: ai.message,
    });
    loadTimeline();
    toast.success("Saved to timeline");
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  }

  if (!lead)
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );

  return (
    <div className="space-y-5">
      <Link href="/pipeline" className="flex items-center gap-1 text-sm text-slate-400 hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> Pipeline
      </Link>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left: lead info + timeline */}
        <div className="space-y-5 lg:col-span-1">
          <div className="glass p-5">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold">{lead.name}</h1>
              {lead.score > 0 && <Badge>{lead.score}° hot</Badge>}
            </div>
            <div className="mt-3 space-y-1.5 text-sm text-slate-300">
              {lead.whatsapp && (
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-emerald-400" /> {lead.whatsapp}
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-brand" /> {lead.phone}
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-purple-400" /> {lead.email}
                </div>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <Info label="Budget" value={lead.budget_max ? `up to ${aed(lead.budget_max)}` : "open"} />
              <Info label="Bedrooms" value={lead.bedrooms ? `${lead.bedrooms} BR` : "any"} />
              <Info label="Type" value={lead.property_type || "any"} />
              <Info label="Language" value={lead.language} />
            </div>
            {lead.preferred_locations && (
              <p className="mt-3 text-xs text-slate-400">📍 {lead.preferred_locations}</p>
            )}
            {lead.notes && <p className="mt-2 text-xs text-slate-400">📝 {lead.notes}</p>}

            <div className="mt-4">
              <span className="mb-1 block text-xs text-slate-400">Pipeline stage</span>
              <select
                value={lead.status}
                onChange={(e) => changeStatus(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-3 py-2 text-sm outline-none focus:border-brand"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Timeline */}
          <div className="glass p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-300">Activity timeline</h3>
            <form onSubmit={addNote} className="mb-4 space-y-2">
              <div className="flex gap-2">
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="rounded-lg border border-white/10 bg-ink-700/60 px-2 py-2 text-xs outline-none focus:border-brand"
                >
                  {["note", "call", "whatsapp", "email", "meeting", "viewing"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Log an activity…" />
                <Button type="submit" size="icon" variant="secondary">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
            <div className="space-y-3">
              {timeline.length === 0 && <p className="text-xs text-slate-500">No activity yet.</p>}
              {timeline.map((it) => (
                <div key={it.id} className="border-l-2 border-brand/40 pl-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Badge variant="muted">{it.channel}</Badge>
                    <span>{new Date(it.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">{it.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: AI assistant */}
        <div className="space-y-4 lg:col-span-2">
          <div className="glass p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <Sparkles className="h-4 w-4 text-brand" /> AI assistant
            </h3>
            <p className="mt-1 text-xs text-slate-400">Match listings, draft a pitch, or generate marketing.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={runMatch} disabled={!!aiBusy}>
                {aiBusy === "match" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Match properties
              </Button>
              <Button onClick={() => runPitch("whatsapp")} disabled={!!aiBusy} variant="secondary">
                {aiBusy === "whatsapp" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                WhatsApp pitch
              </Button>
              <Button onClick={() => runPitch("email")} disabled={!!aiBusy} variant="secondary">
                {aiBusy === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Email pitch
              </Button>
            </div>
          </div>

          {ai && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {ai.kind === "match" && ai.analysis && (
                <div className="glass whitespace-pre-wrap p-4 text-sm leading-relaxed text-slate-200">
                  {ai.analysis}
                </div>
              )}
              {ai.kind === "pitch" && ai.message && (
                <div className="glass p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant={ai.channel === "whatsapp" ? "success" : "default"}>{ai.channel} pitch</Badge>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => copy(ai.message!)}>
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </Button>
                      <Button size="sm" variant="ghost" onClick={savePitch}>
                        <Save className="h-3.5 w-3.5" /> Save to timeline
                      </Button>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-100">{ai.message}</p>
                </div>
              )}

              {ai.properties.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {ai.properties.map((p) => (
                    <PropertyCard
                      key={p.id}
                      p={p}
                      action={
                        <Button size="sm" variant="outline" className="w-full" onClick={() => runMarketing(p.id)}>
                          <Megaphone className="h-3.5 w-3.5" /> Marketing
                        </Button>
                      }
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Marketing modal */}
      {marketing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass max-h-[85vh] w-full max-w-2xl overflow-y-auto p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-bold">
                <Megaphone className="h-5 w-5 text-brand" /> Marketing assets
              </h3>
              <button onClick={() => setMarketing(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            {marketing.busy ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-brand" />
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(marketing.assets).map(([ch, text]) => (
                  <div key={ch} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <Badge variant="gold">{ch}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => copy(text)}>
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </Button>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-200">{text}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-slate-200">{value}</div>
    </div>
  );
}
