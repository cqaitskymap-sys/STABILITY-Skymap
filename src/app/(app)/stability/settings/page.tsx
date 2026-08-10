"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Database, RefreshCw } from "lucide-react";
import { Button, Card, CardHeader, PageHeader } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { friendlyError } from "@/lib/utils";
import { refreshAlerts } from "@/services/inventory";
import { seedDemoData } from "@/services/seed";

export default function StabilitySettingsPage() {
  const { profile, hasPermission } = useAuth();
  const [seeding, setSeeding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (!hasPermission("seed.demo")) {
    return (
      <div>
        <PageHeader title="Settings" description="Admin tools for demo data and alert refresh." />
        <Card className="p-6 text-sm text-slate-600">You do not have permission to access admin settings.</Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Stability Settings"
        description="Development helpers for seeding demo data and regenerating alerts."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Demo / Seed Data"
            description="Creates masters, chambers, products, batches, and sample studies. Safe to re-run — existing studies are not duplicated."
          />
          <div className="p-4">
            <Button
              loading={seeding}
              onClick={async () => {
                if (!profile) return;
                setSeeding(true);
                try {
                  const result = await seedDemoData(profile);
                  toast.success(result.message);
                } catch (err) {
                  toast.error(friendlyError(err));
                } finally {
                  setSeeding(false);
                }
              }}
            >
              <Database className="h-4 w-4" />
              Seed Demo Data
            </Button>
          </div>
        </Card>
        <Card>
          <CardHeader title="Alerts" description="Recalculate operational alerts from current inventory and pull points." />
          <div className="p-4">
            <Button
              variant="outline"
              loading={refreshing}
              onClick={async () => {
                setRefreshing(true);
                try {
                  const count = await refreshAlerts();
                  toast.success(`Alerts refreshed (${count}).`);
                } catch (err) {
                  toast.error(friendlyError(err));
                } finally {
                  setRefreshing(false);
                }
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Alerts
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
