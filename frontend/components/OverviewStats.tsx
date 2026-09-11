import type { DashboardStats } from "@/lib/types";

export default function OverviewStats({ stats }: { stats: DashboardStats }) {
  const cards = [
    { label: "Days to event", value: stats.daysToEvent ?? "—" },
    { label: "Task completion", value: `${stats.completionPct}%`, sub: `${stats.doneTasks}/${stats.totalTasks} done` },
    { label: "Vendors confirmed", value: `${stats.confirmedVendors}/${stats.totalVendors}` },
    {
      label: "Open risks",
      value: stats.openRisks,
      sub: stats.criticalRisks > 0 ? `${stats.criticalRisks} critical` : undefined,
      alert: stats.criticalRisks > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className={`rounded-xl border p-4 bg-white ${c.alert ? "border-red-200" : "border-slate-200"}`}>
          <p className="text-xs text-slate-500">{c.label}</p>
          <p className={`text-2xl font-semibold mt-1 ${c.alert ? "text-red-600" : "text-slate-900"}`}>{c.value}</p>
          {c.sub && <p className="text-xs text-slate-400 mt-0.5">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}
