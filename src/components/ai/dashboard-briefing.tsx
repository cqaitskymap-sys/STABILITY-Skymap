"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { Button, Card, CardHeader, ErrorState, LoadingSkeleton } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { getInventoryContext } from "@/lib/ai/inventory-context";
import { openAiAssistant } from "@/lib/ai/events";

export function DashboardBriefing() {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
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
      setText(data.text || "No briefing available.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate briefing.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />
      {loading ? <LoadingSkeleton rows={3} /> : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error ? (
        <div className="whitespace-pre-wrap px-5 py-4 text-sm leading-7 text-slate-700 sm:px-6">{text}</div>
      ) : null}
    </Card>
  );
}
