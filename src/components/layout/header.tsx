"use client";

import { Bell, ChevronRight, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { Badge, Button } from "@/components/ui";
import { openAiAssistant } from "@/lib/ai/events";

function initials(name?: string) {
  if (!name) return "U";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function Header({
  title,
  breadcrumbs,
  onMenuClick,
  collapsed,
  onToggleCollapse,
  alertCount = 0,
}: {
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
  onMenuClick: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  alertCount?: number;
}) {
  const { profile, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
            onClick={onMenuClick}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            className="hidden rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 lg:inline-flex"
            onClick={onToggleCollapse}
            aria-label="Toggle sidebar"
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
          <div className="min-w-0">
            {breadcrumbs?.length ? (
              <div className="mb-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                {breadcrumbs.map((b, i) => (
                  <span key={b.label} className="flex items-center gap-1">
                    {i > 0 ? <ChevronRight className="h-3 w-3 text-slate-300" /> : null}
                    {b.href ? (
                      <Link href={b.href} className="transition hover:text-teal-700">
                        {b.label}
                      </Link>
                    ) : (
                      <span className="text-slate-400">{b.label}</span>
                    )}
                  </span>
                ))}
              </div>
            ) : null}
            <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">{title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => openAiAssistant()}
            className="hidden items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium text-teal-800 transition hover:bg-teal-50 sm:inline-flex"
            aria-label="Ask SkyMap AI"
          >
            <Sparkles className="h-4 w-4" />
            Ask AI
          </button>
          <Link
            href="/stability/alerts"
            className="relative rounded-xl p-2 text-slate-600 transition hover:bg-slate-100"
            aria-label="Alerts"
          >
            <Bell className="h-5 w-5" />
            {alertCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white shadow-sm">
                {alertCount > 99 ? "99+" : alertCount}
              </span>
            ) : null}
          </Link>
          <div className="hidden items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white/70 px-2 py-1.5 pr-3 shadow-sm sm:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-[11px] font-bold text-white">
              {initials(profile?.displayName)}
            </div>
            <div className="text-right">
              <p className="text-sm font-medium leading-tight text-slate-800">{profile?.displayName}</p>
              <p className="text-[11px] text-slate-500">{profile?.employeeId || profile?.email}</p>
            </div>
            <Badge tone="teal">{profile?.role || "User"}</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={() => logout()} aria-label="Logout">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
