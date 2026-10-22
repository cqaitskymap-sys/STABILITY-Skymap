"use client";

import { Bell, ChevronRight, LayoutGrid, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  hideNav = false,
}: {
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
  onMenuClick: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  alertCount?: number;
  hideNav?: boolean;
}) {
  const { profile, logout, hasPermission } = useAuth();
  const pathname = usePathname();
  const isHome = pathname === "/home";

  return (
    <header className="app-header sticky top-0 z-30 border-b border-white/10 bg-[#071022]/55 pt-[env(safe-area-inset-top)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {!hideNav ? (
            <>
              <button
                className="rounded-xl p-2 text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
                onClick={onMenuClick}
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
              <button
                className="hidden rounded-xl p-2 text-slate-300 transition hover:bg-white/10 hover:text-white lg:inline-flex"
                onClick={onToggleCollapse}
                aria-label="Toggle sidebar"
              >
                {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
              </button>
            </>
          ) : null}
          <div className="min-w-0">
            {breadcrumbs?.length ? (
              <div className="mb-0.5 hidden items-center gap-1 text-xs text-slate-400 sm:flex">
                {breadcrumbs.map((b, i) => (
                  <span key={b.label} className="flex min-w-0 items-center gap-1">
                    {i > 0 ? <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" /> : null}
                    {b.href ? (
                      <Link href={b.href} className="truncate transition hover:text-white">
                        {b.label}
                      </Link>
                    ) : (
                      <span className="truncate text-slate-400">{b.label}</span>
                    )}
                  </span>
                ))}
              </div>
            ) : null}
            <h1 className="truncate text-base font-semibold tracking-tight text-white sm:text-xl">{title}</h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          {!isHome ? (
            <>
              <Link
                href="/home"
                className="inline-flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white sm:px-2.5"
                aria-label="All modules"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden md:inline">Modules</span>
              </Link>
              <button
                type="button"
                onClick={() => openAiAssistant()}
                className="hidden items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium text-indigo-200 transition hover:bg-indigo-400/15 sm:inline-flex"
                aria-label="Ask SkyMap AI"
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden md:inline">Ask AI</span>
              </button>
              {hasPermission("reports.view") ? (
                <Link
                  href="/stability/alerts"
                  className="relative rounded-xl p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                  aria-label="Alerts"
                >
                  <Bell className="h-5 w-5" />
                  {alertCount > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white shadow-sm">
                      {alertCount > 99 ? "99+" : alertCount}
                    </span>
                  ) : null}
                </Link>
              ) : null}
            </>
          ) : null}
          <div className="flex items-center gap-2 rounded-2xl border border-white/12 bg-white/6 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:gap-2.5 sm:px-2 sm:py-1.5 sm:pr-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-bold text-white">
              {initials(profile?.displayName)}
            </div>
            <div className="hidden min-w-0 text-right sm:block">
              <p className="max-w-[10rem] truncate text-sm font-medium leading-tight text-slate-100 lg:max-w-[14rem]">
                {profile?.displayName}
              </p>
              <p className="max-w-[10rem] truncate text-[11px] text-slate-500 lg:max-w-[14rem]">
                {profile?.employeeId || profile?.email}
              </p>
            </div>
            <Badge tone="teal" className="hidden md:inline-flex">
              {profile?.role || "User"}
            </Badge>
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
