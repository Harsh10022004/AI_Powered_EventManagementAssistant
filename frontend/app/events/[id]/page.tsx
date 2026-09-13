"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useRequireAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";
import type { DashboardSnapshot } from "@/lib/types";
import ChatPanel from "@/components/ChatPanel";
import OverviewStats from "@/components/OverviewStats";
import TaskBoard from "@/components/TaskBoard";
import VendorTable from "@/components/VendorTable";
import RiskPanel from "@/components/RiskPanel";

type Tab = "tasks" | "vendors" | "risks";

export default function EventDashboardPage() {
  const ready = useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [tab, setTab] = useState<Tab>("tasks");
  const [fallbackNotice, setFallbackNotice] = useState(false);

  async function refresh() {
    const snapshot = await api<DashboardSnapshot>(`/events/${id}/dashboard`);
    setData(snapshot);
  }

  useEffect(() => {
    if (ready && id) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, id]);

  if (!ready || !data) return <div className="p-10 text-sm text-slate-400">Loading…</div>;

  const { event, tasks, vendors, risks, messages, stats } = data;

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <Link href="/events" className="text-xs text-slate-400 hover:text-slate-600">← All events</Link>
          <h1 className="text-2xl font-semibold mt-0.5">{event.title}</h1>
        </div>
      </div>

      {fallbackNotice && (
        <div className="mb-4 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2">
          Running in offline mode (no GROQ_API_KEY configured on the backend) — using the deterministic keyword fallback instead of the LLM.
        </div>
      )}

      <div className="mb-5">
        <OverviewStats stats={stats} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 items-start">
        <div className="h-[70vh] lg:sticky lg:top-6">
          <ChatPanel
            eventId={event._id}
            messages={messages}
            onResult={(res: any) => {
              setFallbackNotice(!!res.usedFallback);
              setData((prev) =>
                prev
                  ? {
                      ...prev,
                      event: res.event ?? prev.event,
                      tasks: res.tasks ?? prev.tasks,
                      vendors: res.vendors ?? prev.vendors,
                      risks: res.risks ?? prev.risks,
                      messages: [...prev.messages, res.userMessage, res.assistantMessage],
                      stats: recomputeStats(res.tasks ?? prev.tasks, res.vendors ?? prev.vendors, res.risks ?? prev.risks, res.event ?? prev.event),
                    }
                  : prev
              );
            }}
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex gap-1 mb-4 border-b border-slate-100">
            {(["tasks", "vendors", "risks"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                  tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {t === "tasks" ? `Tasks (${tasks.length})` : t === "vendors" ? `Vendors (${vendors.length})` : `Risks (${risks.length})`}
              </button>
            ))}
          </div>

          {tab === "tasks" && <TaskBoard eventId={event._id} tasks={tasks} onChanged={refresh} />}
          {tab === "vendors" && <VendorTable eventId={event._id} vendors={vendors} onChanged={refresh} />}
          {tab === "risks" && <RiskPanel eventId={event._id} risks={risks} onChanged={refresh} />}
        </div>
      </div>
    </div>
  );
}

// Mirrors the backend's stat computation so the UI updates instantly after a
// chat turn without waiting on a full dashboard refetch.
function recomputeStats(tasks: DashboardSnapshot["tasks"], vendors: DashboardSnapshot["vendors"], risks: DashboardSnapshot["risks"], event: DashboardSnapshot["event"]) {
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const daysToEvent = event.startDate ? Math.ceil((new Date(event.startDate).getTime() - Date.now()) / 86400000) : null;
  return {
    totalTasks,
    doneTasks,
    completionPct: totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0,
    openRisks: risks.length,
    criticalRisks: risks.filter((r) => r.severity === "critical").length,
    confirmedVendors: vendors.filter((v) => v.status === "confirmed").length,
    totalVendors: vendors.length,
    daysToEvent,
  };
}
