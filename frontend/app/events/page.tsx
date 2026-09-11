"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth, useLogout } from "@/lib/useAuth";
import { api } from "@/lib/api";
import type { EventDoc } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = { wedding: "Wedding", corporate: "Corporate", other: "Other" };

export default function EventsPage() {
  const ready = useRequireAuth();
  const logout = useLogout();
  const [events, setEvents] = useState<EventDoc[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const data = await api<{ events: EventDoc[] }>("/events");
    setEvents(data.events);
    setLoading(false);
  }

  useEffect(() => {
    if (ready) refresh();
  }, [ready]);

  if (!ready) return null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Your events</h1>
          <p className="text-sm text-slate-500">Every conversation, task and risk lives inside one of these.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowForm((s) => !s)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
            + New event
          </button>
          <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-800 px-3 py-2">Log out</button>
        </div>
      </div>

      {showForm && <NewEventForm onCreated={() => { setShowForm(false); refresh(); }} />}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : events.length === 0 ? (
        <div className="text-center py-20 text-slate-400 text-sm">No events yet. Create your first one above.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((ev) => (
            <Link key={ev._id} href={`/events/${ev._id}`} className="block bg-white border border-slate-200 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-sm transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wide text-indigo-600">{TYPE_LABEL[ev.type]}</span>
                <span className="text-xs text-slate-400">{ev.status}</span>
              </div>
              <h2 className="font-semibold text-slate-900">{ev.title}</h2>
              <p className="text-sm text-slate-500 mt-1">{ev.guestCount} guests{ev.startDate ? ` · from ${new Date(ev.startDate).toLocaleDateString()}` : ""}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function NewEventForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("wedding");
  const [guestCount, setGuestCount] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [subEventsText, setSubEventsText] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await api("/events", {
      method: "POST",
      body: {
        title, type, guestCount,
        startDate: startDate || null,
        endDate: endDate || null,
        subEvents: subEventsText.split(",").map((s) => s.trim()).filter(Boolean),
      },
    });
    setSaving(false);
    onCreated();
  }

  return (
    <form onSubmit={onSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium mb-1">Event title</label>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder='e.g. "Ananya & Rohan Wedding"'
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Type</label>
        <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="wedding">Wedding</option>
          <option value="corporate">Corporate</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Expected guest count</label>
        <input type="number" min={0} value={guestCount} onChange={(e) => setGuestCount(Number(e.target.value))}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Start date</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">End date</label>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium mb-1">Sub-events (comma separated)</label>
        <input value={subEventsText} onChange={(e) => setSubEventsText(e.target.value)} placeholder="Sangeet, Haldi, Wedding Ceremony, Reception"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div className="sm:col-span-2">
        <button disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg">
          {saving ? "Creating…" : "Create event"}
        </button>
      </div>
    </form>
  );
}
