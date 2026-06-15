"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles, Send } from "lucide-react";
import { api, Property } from "@/lib/api";
import { aed } from "@/lib/format";

interface SearchResult {
  answer: string;
  properties: Property[];
}

const EXAMPLES = [
  "3 bed apartments in Dubai Marina under 5M with a pool",
  "Cheapest 1 bedroom in JVC",
  "Luxury villas in Palm Jumeirah above 25M",
  "Penthouses in Downtown Dubai",
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(q: string) {
    if (!q.trim()) return;
    setBusy(true);
    setError("");
    try {
      setResult(await api.post<SearchResult>("/api/ai/search", { query: q }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-6 w-6 text-brand" /> AI Property Search
        </h1>
        <p className="text-sm text-slate-400">Ask in plain English — the assistant searches your inventory.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
        className="glass flex items-center gap-2 p-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. 2 bed in Business Bay under 2.5M with a balcony"
          className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
        />
        <button
          disabled={busy}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-glow disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Search
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => {
              setQuery(ex);
              run(ex);
            }}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:border-brand hover:text-brand"
          >
            {ex}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="glass whitespace-pre-wrap p-4 text-sm leading-relaxed text-slate-200">
            {result.answer}
          </div>
          {result.properties.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {result.properties.map((p) => (
                <div key={p.id} className="glass p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {p.bedrooms}BR {p.type}
                    </span>
                    <span className="font-bold text-brand">{aed(p.price)}</span>
                  </div>
                  <div className="text-sm text-slate-300">
                    {p.building}, {p.location}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {p.size_sqft.toLocaleString()} sqft · {p.possession}
                    {p.has_pool ? " · Pool" : ""}
                    {p.has_gym ? " · Gym" : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
