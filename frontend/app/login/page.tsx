"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [form, setForm] = useState({ agency: "", name: "", email: "demo@demo.ae", password: "demo12345" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await signup(form.agency, form.name, form.email, form.password);
      toast.success(mode === "login" ? "Welcome back" : "Agency created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center p-6">
      <Link href="/" className="absolute left-6 top-6 flex items-center gap-1 text-sm text-slate-400 hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass w-full max-w-md p-8"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-600 shadow-glow">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Dubai AI Broker</h1>
            <p className="text-sm text-slate-400">
              {mode === "login" ? "Sign in to your agency" : "Create your agency"}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <>
              <Field label="Agency name">
                <Input value={form.agency} onChange={(e) => setForm({ ...form, agency: e.target.value })} required />
              </Field>
              <Field label="Your name">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </Field>
            </>
          )}
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </Field>

          <Button type="submit" disabled={busy} className="w-full" size="lg">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "Sign in" : "Create agency"}
          </Button>
        </form>

        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 w-full text-center text-sm text-slate-400 transition hover:text-brand"
        >
          {mode === "login" ? "New here? Create an agency" : "Have an account? Sign in"}
        </button>

        {mode === "login" && (
          <p className="mt-4 text-center text-xs text-slate-500">Demo: demo@demo.ae / demo12345</p>
        )}
      </motion.div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}
