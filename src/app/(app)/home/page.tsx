"use client";

import Link from "next/link";
import { ArrowRight, Boxes, Shield, ShieldCheck } from "lucide-react";
import { DeveloperCredit } from "@/components/brand/developer-credit";
import { SkymapLogo } from "@/components/brand/skymap-logo";
import { useAuth } from "@/contexts/auth-context";
import { APP_MODULES, canAccessModule, moduleHref, type AppModuleId } from "@/lib/modules";
import { cn } from "@/lib/utils";

const MODULE_VISUAL: Record<
  AppModuleId,
  {
    icon: typeof Shield;
    accent: string;
    iconWrap: string;
    glow: string;
  }
> = {
  "control-samples": {
    icon: Shield,
    accent: "hover:border-teal-300 hover:shadow-teal-200/50",
    iconWrap: "bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-teal-600/30",
    glow: "from-teal-400/20",
  },
  stability: {
    icon: Boxes,
    accent: "hover:border-sky-300 hover:shadow-sky-200/50",
    iconWrap: "bg-gradient-to-br from-sky-500 to-indigo-700 text-white shadow-sky-600/30",
    glow: "from-sky-400/20",
  },
  admin: {
    icon: ShieldCheck,
    accent: "hover:border-slate-300 hover:shadow-slate-300/60",
    iconWrap: "bg-gradient-to-br from-slate-700 to-slate-950 text-white shadow-slate-700/30",
    glow: "from-slate-400/20",
  },
};

export default function ModuleHomePage() {
  const { profile, hasPermission } = useAuth();
  const modules = APP_MODULES.filter((mod) => canAccessModule(mod.id, hasPermission));

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-5xl flex-col justify-center py-4 sm:py-8">
      <div className="mb-8 text-center sm:mb-12">
        <div className="mb-5 flex justify-center">
          <SkymapLogo priority className="h-14 w-auto max-w-[200px] sm:h-16" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Quality Assurance</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Welcome{profile?.displayName ? `, ${profile.displayName}` : ""}
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
          Select a module to continue. Each area opens with its own menu and workflows.
        </p>
      </div>

      {modules.length === 0 ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-900">
          No modules are assigned to your account. Contact an administrator for access.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => {
            const visual = MODULE_VISUAL[mod.id];
            const Icon = visual.icon;
            return (
              <Link
                key={mod.id}
                href={moduleHref(mod.id, hasPermission)}
                className={cn(
                  "group relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white/90 p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl",
                  visual.accent
                )}
              >
                <div className={cn("pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-gradient-to-br to-transparent blur-2xl", visual.glow)} />
                <div className={cn("relative mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg", visual.iconWrap)}>
                  <Icon className="h-7 w-7" />
                </div>
                <h3 className="relative text-lg font-semibold tracking-tight text-slate-900">{mod.title}</h3>
                <p className="relative mt-2 text-sm leading-6 text-slate-500">{mod.description}</p>
                <span className="relative mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700">
                  Open module
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <DeveloperCredit className="mt-10 text-center" />
    </div>
  );
}
