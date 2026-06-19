"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, LayoutDashboard, KanbanSquare, Sparkles, LogOut, Home, TrendingUp, Sun } from "lucide-react";
import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/listings", label: "Listings", icon: Home },
  { href: "/market", label: "Market Trends", icon: TrendingUp },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/search", label: "AI Search", icon: Sparkles },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-white/10 bg-ink-800/40 p-4 backdrop-blur-xl">
      <Link href="/dashboard" className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-600 shadow-glow">
          <Building2 className="h-5 w-5" />
        </div>
        <span className="font-bold">Dubai Broker</span>
      </Link>

      <nav className="flex-1 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:text-white"
            >
              {active && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl bg-brand/15 ring-1 ring-brand/30"
                />
              )}
              <Icon className="relative z-10 h-4 w-4" />
              <span className="relative z-10">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/10 pt-3">
        <div className="px-2 pb-2 text-xs text-slate-400">
          <div className="font-medium text-slate-200">{user?.full_name}</div>
          <div className="capitalize">{user?.role}</div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-400 transition hover:bg-white/5 hover:text-red-300"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}
