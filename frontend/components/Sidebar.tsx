"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  LayoutDashboard,
  KanbanSquare,
  Sparkles,
  LogOut,
  Home,
  TrendingUp,
  Sun,
  Menu,
  X,
  ShieldCheck,
} from "lucide-react";
import { api, ReviewCounts } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Grouped so the order matches an agent's day: start with what needs doing,
 * then work leads, then look at stock and numbers. A flat list of six items
 * gave no hint which one to open first.
 */
const NAV_GROUPS = [
  {
    label: "Work",
    items: [
      { href: "/today", label: "Today", icon: Sun, hint: "Who to chase" },
      { href: "/pipeline", label: "Pipeline", icon: KanbanSquare, hint: "All your leads" },
    ],
  },
  {
    label: "Find",
    items: [
      { href: "/search", label: "AI Search", icon: Sparkles, hint: "Ask in plain English" },
      { href: "/listings", label: "Listings", icon: Home, hint: "Your inventory" },
    ],
  },
  {
    label: "Sell",
    items: [
      { href: "/my-listings", label: "My Listings", icon: Building2, hint: "What you've submitted" },
      // Admin-only; filtered out below for agents rather than hidden with CSS.
      { href: "/review", label: "Verify", icon: ShieldCheck, hint: "Approve broker stock", adminOnly: true },
    ],
  },
  {
    label: "Analyse",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, hint: "Overview" },
      { href: "/market", label: "Market Trends", icon: TrendingUp, hint: "Pricing insight" },
    ],
  },
];

function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <Link href="/dashboard" onClick={onClick} className="flex items-center gap-2 px-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-600 shadow-glow">
        <Building2 className="h-5 w-5 text-ink-950" />
      </div>
      <span className="font-bold">Dubai Broker</span>
    </Link>
  );
}

/** Nav + account block, shared by the desktop rail and the mobile drawer so
 *  the two can never drift apart. */
function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const [pending, setPending] = useState(0);

  // Admins need to know work is waiting without opening the page. Refreshed on
  // navigation so approving something updates the badge on the way out.
  useEffect(() => {
    if (!isAdmin) return;
    api
      .get<ReviewCounts>("/api/listings/review/counts")
      .then((c) => setPending(c.pending))
      .catch(() => setPending(0));
  }, [isAdmin, pathname]);

  return (
    <>
      <nav className="flex-1 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((i) => !("adminOnly" in i && i.adminOnly) || isAdmin);
          if (items.length === 0) return null;
          return (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {items.map(({ href, label, icon: Icon, hint }) => {
                // Sub-routes keep the parent highlighted, so /listings/42 still
                // reads as "you are in Listings".
                const active = pathname === href || pathname.startsWith(`${href}/`);
                const badge = href === "/review" ? pending : 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    // min-h-11 keeps every row at a comfortable touch target.
                    className="group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition hover:text-white"
                  >
                    {active && (
                      <motion.div
                        layoutId="nav-active"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        className="absolute inset-0 rounded-xl bg-brand/15 ring-1 ring-brand/30"
                      />
                    )}
                    <Icon
                      className={`relative z-10 h-4 w-4 shrink-0 ${active ? "text-brand" : "text-slate-400"}`}
                    />
                    <span className="relative z-10 flex min-w-0 flex-col leading-tight">
                      <span>{label}</span>
                      <span className="truncate text-[10px] font-normal text-slate-500 group-hover:text-slate-400">
                        {hint}
                      </span>
                    </span>
                    {badge > 0 && (
                      <span className="relative z-10 ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400/20 px-1.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-400/30">
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/10 pt-3">
        <div className="px-2 pb-2 text-xs text-slate-400">
          <div className="truncate font-medium text-slate-200">{user?.full_name}</div>
          <div className="capitalize">{user?.role}</div>
        </div>
        <button
          onClick={logout}
          className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-400 transition hover:bg-white/5 hover:text-red-300"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </>
  );
}

/** Fixed rail — desktop only. */
export function DesktopSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/10 bg-ink-800/40 p-4 backdrop-blur-xl lg:flex">
      <div className="mb-8">
        <Brand />
      </div>
      <NavContent />
    </aside>
  );
}

/**
 * Mobile header + slide-in drawer.
 *
 * The rail used to render at a fixed 240px on every screen, which on a 375px
 * phone left roughly 90px for actual content. Below `lg` it now collapses
 * behind this hamburger instead.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on navigation, and lock body scroll while the drawer is open.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Escape closes the drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-ink-900/85 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Brand />
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/5 hover:text-white"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="absolute inset-y-0 left-0 flex w-[min(17rem,85vw)] flex-col border-r border-white/10 bg-ink-800 p-4"
            >
              <div className="mb-6 flex items-center justify-between">
                <Brand onClick={() => setOpen(false)} />
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/5 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavContent onNavigate={() => setOpen(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
