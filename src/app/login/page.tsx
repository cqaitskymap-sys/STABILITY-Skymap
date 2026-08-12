"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { toast, Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { SkymapLogo } from "@/components/brand/skymap-logo";
import { Button, Card, Input } from "@/components/ui";
import { friendlyError } from "@/lib/utils";

function LoginForm() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/stability/dashboard");
  }, [loading, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(employeeId, password);
      toast.success("Signed in successfully.");
      router.replace("/stability/dashboard");
    } catch (error) {
      toast.error(friendlyError(error, "Unable to sign in. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(13,148,136,0.16),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(37,99,235,0.12),transparent_30%),linear-gradient(180deg,#f8fafc,#eef6f5)]" />
      <Card className="relative w-full max-w-md overflow-hidden">
        <div className="border-b border-slate-800 bg-slate-950 px-6 py-7 text-white">
          <div className="flex flex-col items-center text-center">
            <SkymapLogo priority className="h-16 w-auto max-w-[220px]" />
            <p className="mt-3 text-sm font-medium text-sky-200">Stability Sample Inventory</p>
            <p className="mt-1 text-xs text-slate-400">Pharmaceutical Quality Assurance</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 px-6 py-6">
          <div className="rounded-lg border border-teal-100 bg-teal-50/70 p-3 text-sm text-teal-900">
            <div className="mb-1 flex items-center gap-2 font-medium">
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
          <Button type="submit" className="w-full" loading={submitting}>
            Sign in
          </Button>
          <p className="text-center text-xs text-slate-500">
            Contact your system administrator if you need an account.
          </p>
        </form>
      </Card>
      <Toaster richColors position="top-right" />
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
