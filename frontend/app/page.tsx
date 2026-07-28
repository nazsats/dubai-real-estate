"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Building2,
  Sparkles,
  KanbanSquare,
  MessageSquare,
  BarChart3,
  Send,
  MapPin,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: Sparkles, title: "AI property matching", desc: "Describe a buyer in plain English; get the best listings ranked with reasons." },
  { icon: MessageSquare, title: "Instant pitches", desc: "Generate ready-to-send WhatsApp & email pitches in the client's language." },
  { icon: KanbanSquare, title: "Visual pipeline", desc: "Track every lead from first contact to closed deal on a live kanban board." },
  { icon: BarChart3, title: "Live analytics", desc: "Market map, price trends, conversion and revenue — all in real time." },
  { icon: Send, title: "Telegram agent", desc: "Operate the whole assistant from Telegram. WhatsApp coming soon." },
  { icon: MapPin, title: "Dubai-native", desc: "Built for Dubai areas, AED pricing, and the local market from day one." },
];

const STATS = [
  { value: "8+", label: "tasks automated" },
  { value: "30s", label: "to a client pitch" },
  { value: "1", label: "place for everything" },
  { value: "24/7", label: "AI assistant" },
];

export default function Landing() {
  return (
    <div className="relative overflow-hidden">
      {/* Nav */}
      <header className="container flex items-center justify-between py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-600 shadow-glow">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="font-bold">Dubai AI Broker</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/login">Get started</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="container relative pb-16 pt-12 text-center lg:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-3xl"
        >
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-slate-300">
            <Sparkles className="h-3.5 w-3.5 text-brand" /> Powered by Claude — built for Dubai agents
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Your AI <span className="text-gradient">real-estate broker</span>, working 24/7
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
            Capture leads, match properties, pitch clients, run marketing, and track every deal —
            automated end to end. The whole brokerage workflow in one place.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/login">
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/dashboard">View demo</Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-slate-500">Demo login: demo@demo.ae / demo12345</p>
        </motion.div>

        {/* Floating mock dashboard */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="relative mx-auto mt-14 max-w-4xl"
        >
          <div className="absolute -inset-x-10 -top-10 h-40 bg-brand/20 blur-3xl" />
          <div className="glass relative animate-float p-2">
            <div className="rounded-xl bg-ink-800/80 p-4">
              <div className="mb-3 flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-400/70" />
                <span className="h-3 w-3 rounded-full bg-amber-400/70" />
                <span className="h-3 w-3 rounded-full bg-emerald-400/70" />
              </div>
              {/* 2-up on phones — four columns at 390px squeezed "tasks
                  automated" onto three cramped lines. */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {STATS.map((s) => (
                  <div key={s.label} className="rounded-lg border border-white/5 bg-white/[0.03] p-3 text-left">
                    <div className="text-xl font-bold text-gradient">{s.value}</div>
                    <div className="text-[10px] text-slate-400">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="col-span-2 h-28 rounded-lg bg-gradient-to-br from-brand/10 to-transparent ring-1 ring-white/5" />
                <div className="h-28 rounded-lg bg-gradient-to-br from-purple-500/10 to-transparent ring-1 ring-white/5" />
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="container py-16">
        <h2 className="text-center text-3xl font-bold">Everything a broker does — automated</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-slate-400">
          One assistant for inventory, leads, pitching, marketing, and revenue.
        </p>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="glass card-hover p-5"
            >
              <div className="mb-3 inline-flex rounded-xl bg-gradient-to-br from-brand/20 to-brand-600/20 p-2.5 ring-1 ring-brand/20">
                <f.icon className="h-5 w-5 text-brand" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-400">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container pb-24">
        <div className="glass relative overflow-hidden p-10 text-center">
          <div className="absolute -inset-x-20 -top-24 h-48 bg-brand/20 blur-3xl" />
          <h2 className="relative text-3xl font-bold">Close more deals, with less busywork</h2>
          <p className="relative mx-auto mt-2 max-w-md text-slate-400">
            Spin up your agency in seconds and let the AI handle the rest.
          </p>
          <Button asChild size="lg" className="relative mt-6">
            <Link href="/login">
              Get started free <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="container border-t border-white/5 py-8 text-center text-sm text-slate-500">
        © 2026 Dubai AI Broker · Built for the Dubai real-estate market
      </footer>
    </div>
  );
}
