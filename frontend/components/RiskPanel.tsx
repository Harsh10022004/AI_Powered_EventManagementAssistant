import type { Risk } from "@/lib/types";
import { api } from "@/lib/api";

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-red-50 border-red-200 text-red-700",
  high: "bg-orange-50 border-orange-200 text-orange-700",
  medium: "bg-amber-50 border-amber-200 text-amber-700",
  low: "bg-slate-50 border-slate-200 text-slate-600",
};

const TYPE_LABEL: Record<string, string> = {
  capacity_mismatch: "Capacity mismatch",
  deadline_risk: "Deadline risk",
  missing_vendor: "Missing vendor",
  dependency_block: "Blocked dependency",
  scheduling_conflict: "Scheduling conflict",
  other: "Risk",
};

export default function RiskPanel({ eventId, risks, onChanged }: { eventId: string; risks: Risk[]; onChanged: () => void }) {
  async function setStatus(riskId: string, status: string) {
    await api(`/events/${eventId}/risks/${riskId}`, { method: "PATCH", body: { status } });
    onChanged();
  }

  if (risks.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">No open risks — the rule engine and AI haven't flagged anything.</p>;
  }

  return (
    <div className="space-y-2">
      {risks.map((r) => (
        <div key={r._id} className={`rounded-lg border px-3 py-2 text-sm ${SEVERITY_STYLE[r.severity]}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wide mr-2 opacity-70">
                {TYPE_LABEL[r.type]} · {r.severity} · {r.source === "ai" ? "AI" : "rule"}
              </span>
              <p className="font-medium leading-snug">{r.description}</p>
              {r.suggestedAction && <p className="text-xs mt-1 opacity-80">→ {r.suggestedAction}</p>}
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              {r.status === "open" && (
                <button onClick={() => setStatus(r._id, "acknowledged")} className="text-[11px] underline opacity-70 hover:opacity-100">
                  Acknowledge
                </button>
              )}
              <button onClick={() => setStatus(r._id, "resolved")} className="text-[11px] underline opacity-70 hover:opacity-100">
                Resolve
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
