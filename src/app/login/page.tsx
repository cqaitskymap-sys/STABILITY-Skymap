"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { toast, Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { Button, Card, Input } from "@/components/ui";
import { friendlyError } from "@/lib/utils";
import { seedDemoData } from "@/services/seed";

function LoginForm() {
  const { login, registerDemoAdmin, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("admin@stability.local");
  const [password, setPassword] = useState("Admin@123");
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/stability/dashboard");
  }, [loading, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success("Signed in successfully.");
      router.replace("/stability/dashboard");
    } catch (error) {
      toast.error(friendlyError(error, "Unable to sign in. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  async function initializeDemo() {
    setSeeding(true);
    try {
      await registerDemoAdmin();
      const result = await seedDemoData({
        uid: "pending",
        email: "admin@stability.local",
        displayName: "System Admin",
        role: "Admin",
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      toast.success(result.message);
      router.replace("/stability/dashboard");
    } catch (error) {
      toast.error(friendlyError(error, "Unable to initialize demo environment."));
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(13,148,136,0.16),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(37,99,235,0.12),transparent_30%),linear-gradient(180deg,#f8fafc,#eef6f5)]" />
      <Card className="relative w-full max-w-md overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-r from-teal-700 to-sky-700 px-6 py-6 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/15 p-2.5">
              <FlaskConical className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-semibold">SKYMAP Stability</p>
              <p className="text-sm text-teal-50">Sample Inventory Management</p>
            </div>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 px-6 py-6">
          <div className="rounded-lg border border-teal-100 bg-teal-50/70 p-3 text-sm text-teal-900">
            <div className="mb-1 flex items-center gap-2 font-medium">
              <ShieldCheck className="h-4 w-4" />
              QA secure access
            </div>
            Sign in to manage stability studies, charging, withdrawals, and reconciliation.
          </div>
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
          <Input
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Button type="submit" className="w-full" loading={submitting}>
            Sign in
          </Button>
          <Button type="button" variant="outline" className="w-full" loading={seeding} onClick={initializeDemo}>
            Initialize Demo Environment
          </Button>
          <p className="text-center text-xs text-slate-500">
            Demo: admin@stability.local / Admin@123
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
