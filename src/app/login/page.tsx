"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FlaskConical, Lock, ShieldCheck } from "lucide-react";
import { toast, Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { SkymapLogo } from "@/components/brand/skymap-logo";
import { DeveloperCredit } from "@/components/brand/developer-credit";
import { Button, Card, Input } from "@/components/ui";
import {
  clearRememberedLogin,
  loadRememberedLogin,
  saveRememberedLogin,
} from "@/lib/remember-login";
import { friendlyError } from "@/lib/utils";

function LoginForm() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [rememberPassword, setRememberPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/stability/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    const saved = loadRememberedLogin();
    if (!saved) return;
    setEmployeeId(saved.employeeId);
    setPassword(saved.password);
    setRememberPassword(true);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(employeeId, password, { remember: rememberPassword });
      if (rememberPassword) {
        saveRememberedLogin(employeeId, password);
      } else {
        clearRememberedLogin();
      }
      toast.success("Signed in successfully.");
      router.replace("/stability/dashboard");
    } catch (error) {
      toast.error(friendlyError(error, "Unable to sign in. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  function onRememberChange(checked: boolean) {
    setRememberPassword(checked);
    if (!checked) clearRememberedLogin();
  }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <Image
        src="/brand/stability-lab-bg.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/85 via-slate-950/55 to-teal-950/70" />
      <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-sky-400/15 blur-3xl" />

      <div className="relative z-10 flex min-h-dvh">
        <section className="hidden flex-1 flex-col justify-end p-12 lg:flex xl:p-16">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-100 backdrop-blur">
            <FlaskConical className="h-3.5 w-3.5" />
            Pharmaceutical Quality Assurance
          </div>
          <h1 className="mt-6 max-w-lg text-4xl font-semibold leading-[1.1] tracking-tight text-white xl:text-5xl">
            Stability Sample Inventory
          </h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-slate-200/90">
            Charge samples, track pulls, and keep a complete QA audit trail across every chamber.
          </p>
          <div className="mt-8 grid max-w-md grid-cols-3 gap-3 text-xs text-slate-200">
            {["Live inventory", "Pull calendar", "Audit ready"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/12 bg-white/8 px-3 py-3 backdrop-blur">
                {item}
              </div>
            ))}
          </div>
          <DeveloperCredit className="mt-8" tone="light" />
        </section>

        <section className="flex w-full items-center justify-center px-4 py-[max(2.5rem,env(safe-area-inset-top))] lg:w-[min(100%,34rem)] lg:justify-end lg:pr-10 xl:pr-16">
          <Card className="relative w-full max-w-md overflow-hidden border-white/20 bg-white/92 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 px-4 py-6 text-white sm:px-6 sm:py-8">
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-teal-400/20 blur-2xl" />
              <div className="relative flex flex-col items-center text-center">
                <SkymapLogo priority className="h-16 w-auto max-w-[220px]" />
                <p className="mt-3 text-sm font-medium text-sky-200">Stability Sample Inventory</p>
                <p className="mt-1 text-xs text-slate-400">Pharmaceutical Quality Assurance</p>
              </div>
            </div>
            <form onSubmit={onSubmit} className="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
              <div className="rounded-2xl border border-teal-100 bg-teal-50/80 p-3.5 text-sm text-teal-900">
                <div className="mb-1 flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4" />
                  QA secure access
                </div>
                Sign in with your Employee ID and password. Accounts are created by an Admin.
              </div>

              <Input
                label="Employee ID"
                type="text"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                autoComplete="username"
                hint="Your Employee ID is your login ID."
              />
              <Input
                label="Password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <label className="flex cursor-pointer select-none items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberPassword}
                  onChange={(e) => onRememberChange(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-teal-700"
                />
                <span className="text-sm text-slate-700">Remember password</span>
              </label>
              <Button type="submit" className="w-full" loading={submitting}>
                <Lock className="h-4 w-4" />
                Sign in
              </Button>
              <p className="text-center text-xs text-slate-500">
                Contact your system administrator if you need an account.
              </p>
              <DeveloperCredit className="text-center" tone="muted" />
            </form>
          </Card>
        </section>
      </div>
      <Toaster
        richColors
        position="top-center"
        offset={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
        toastOptions={{
          className: "rounded-xl border-slate-200 shadow-lg !w-[calc(100vw-1.5rem)] sm:!w-auto",
        }}
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
}
