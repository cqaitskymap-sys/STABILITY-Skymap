"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { Button, Card, CardHeader, ErrorState, LoadingSkeleton } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { getInventoryContext } from "@/lib/ai/inventory-context";
import { openAiAssistant } from "@/lib/ai/events";

export function DashboardBriefing() {
  const { user } = useAuth();
  const briefing = useAsync(async () => {
    if (!user) return "";
    const token = await user.getIdToken();
    const context = await getInventoryContext(true);
    const res = await fetch("/api/ai/briefing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ context }),
    });
    const data = (await res.json()) as { text?: string; error?: string };
    if (!res.ok) throw new Error(data.error || "Unable to generate briefing.");
    return data.text || "No briefing available.";
  }, [user?.uid]);

  return (
    <Card className="mb-6 overflow-hidden">
      <CardHeader
        title="AI morning briefing"
        description="Live snapshot of overdue pulls, alerts, and chamber risk."
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => openAiAssistant()}>
              <Sparkles className="h-4 w-4" />
              Ask more
            </Button>
            <Button size="sm" variant="outline" onClick={() => briefing.reload()} disabled={briefing.loading}>
              <RefreshCw className={`h-4 w-4 ${briefing.loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />
      {briefing.loading ? <LoadingSkeleton rows={3} /> : null}
      {briefing.error ? <ErrorState message={briefing.error} onRetry={() => briefing.reload()} /> : null}
      {!briefing.loading && !briefing.error ? (
        <div className="whitespace-pre-wrap px-5 py-4 text-sm leading-7 text-slate-700 sm:px-6">
          {briefing.data}
        </div>
      ) : null}
    </Card>
  );
}
