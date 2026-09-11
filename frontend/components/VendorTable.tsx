import type { Vendor } from "@/lib/types";
import { api } from "@/lib/api";

const STATUS_STYLE: Record<string, string> = {
  not_started: "bg-slate-100 text-slate-500",
  contacted: "bg-sky-100 text-sky-700",
  negotiating: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function VendorTable({ eventId, vendors, onChanged }: { eventId: string; vendors: Vendor[]; onChanged: () => void }) {
  async function setStatus(vendorId: string, status: string) {
    await api(`/events/${eventId}/vendors/${vendorId}`, { method: "PATCH", body: { status } });
    onChanged();
  }

  if (vendors.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">No vendors logged yet — mention one in the chat.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-400 uppercase tracking-wide">
            <th className="py-2 pr-3">Vendor</th>
            <th className="py-2 pr-3">Category</th>
            <th className="py-2 pr-3">Capacity</th>
            <th className="py-2 pr-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((v) => (
            <tr key={v._id} className="border-t border-slate-100">
              <td className="py-2 pr-3 font-medium">{v.name}</td>
              <td className="py-2 pr-3 text-slate-500">{v.category.replace("_", " ")}</td>
              <td className="py-2 pr-3 text-slate-500">{v.capacity ?? "—"}</td>
              <td className="py-2 pr-3">
                <select
                  value={v.status}
                  onChange={(e) => setStatus(v._id, e.target.value)}
                  className={`text-xs rounded-full px-2 py-1 border-0 font-medium ${STATUS_STYLE[v.status]}`}
                >
                  <option value="not_started">Not started</option>
                  <option value="contacted">Contacted</option>
                  <option value="negotiating">Negotiating</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
