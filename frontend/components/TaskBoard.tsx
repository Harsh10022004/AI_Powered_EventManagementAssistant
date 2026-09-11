import type { Task } from "@/lib/types";
import { api } from "@/lib/api";

const COLUMNS: { key: Task["status"]; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
];

const PRIORITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-400",
  low: "bg-slate-300",
};

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function TaskBoard({ eventId, tasks, onChanged }: { eventId: string; tasks: Task[]; onChanged: () => void }) {
  async function move(taskId: string, status: Task["status"]) {
    await api(`/events/${eventId}/tasks/${taskId}`, { method: "PATCH", body: { status } });
    onChanged();
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {COLUMNS.map((col) => {
        const items = tasks.filter((t) => t.status === col.key);
        return (
          <div key={col.key} className="bg-slate-50 rounded-xl p-3 min-h-[120px]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{col.label}</h3>
              <span className="text-xs text-slate-400">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((t) => (
                <div key={t._id} className="bg-white border border-slate-200 rounded-lg p-2.5 text-sm shadow-sm">
                  <div className="flex items-start gap-1.5">
                    <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${PRIORITY_DOT[t.priority]}`} />
                    <div className="min-w-0">
                      <p className="font-medium leading-snug">{t.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {t.category.replace("_", " ")}{t.subEvent ? ` · ${t.subEvent}` : ""}{t.dueDate ? ` · due ${fmtDate(t.dueDate)}` : ""}
                      </p>
                    </div>
                  </div>
                  <select
                    value={t.status}
                    onChange={(e) => move(t._id, e.target.value as Task["status"])}
                    className="mt-2 w-full text-[11px] border border-slate-200 rounded px-1.5 py-1 bg-slate-50"
                  >
                    {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
              ))}
              {items.length === 0 && <p className="text-xs text-slate-300 py-4 text-center">Empty</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
