"use client";

import { Bell, LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { Badge, Button } from "@/components/ui";

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
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={onMenuClick}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            className="hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:inline-flex"
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
                    {i > 0 ? <span>/</span> : null}
                    {b.href ? (
                      <Link href={b.href} className="hover:text-teal-700">
                        {b.label}
                      </Link>
                    ) : (
                      <span>{b.label}</span>
                    )}
                  </span>
                ))}
              </div>
            ) : null}
            <h1 className="truncate text-lg font-semibold text-slate-900 sm:text-xl">{title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/stability/alerts"
            className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Alerts"
          >
            <Bell className="h-5 w-5" />
            {alertCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
                {alertCount > 99 ? "99+" : alertCount}
              </span>
            ) : null}
          </Link>
          <div className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 sm:flex">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">{profile?.displayName}</p>
              <p className="text-xs text-slate-500">{profile?.email}</p>
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
