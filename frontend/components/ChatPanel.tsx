"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Message, DashboardSnapshot } from "@/lib/types";

export default function ChatPanel({
  eventId,
  messages,
  onResult,
}: {
  eventId: string;
  messages: Message[];
  onResult: (data: Partial<DashboardSnapshot> & { diff?: any; usedFallback?: boolean }) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText("");
    try {
      const data = await api(`/events/${eventId}/messages`, { method: "POST", body: { text: trimmed } });
      onResult(data);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold">Conversation</h2>
        <p className="text-xs text-slate-400">Tell the assistant what's changed — it updates the dashboard for you.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3">
            Try: "We are planning a three-day wedding for approximately 400 guests, including a Sangeet, Haldi, Wedding Ceremony and Reception. We need to finalise venue, catering, décor, photography, entertainment, accommodation, transportation and invitations."
          </div>
        )}
        {messages.map((m) => (
          <div key={m._id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
              m.role === "user" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"
            }`}>
              <p className="whitespace-pre-wrap leading-snug">{m.text}</p>
              {m.role === "assistant" && m.actionsSummary && hasActions(m.actionsSummary) && (
                <p className="text-[11px] mt-1.5 opacity-70">{actionsLine(m.actionsSummary)}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="border-t border-slate-100 p-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type an update…"
          disabled={sending}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
        />
        <button
          disabled={sending || !text.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg shrink-0"
        >
          {sending ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}

function hasActions(a: Message["actionsSummary"]) {
  if (!a) return false;
  return a.tasksCreated + a.tasksUpdated + a.vendorsCreated + a.vendorsUpdated + a.risksRaised > 0;
}

function actionsLine(a: NonNullable<Message["actionsSummary"]>) {
  const parts: string[] = [];
  if (a.tasksCreated) parts.push(`+${a.tasksCreated} task${a.tasksCreated > 1 ? "s" : ""}`);
  if (a.tasksUpdated) parts.push(`${a.tasksUpdated} task${a.tasksUpdated > 1 ? "s" : ""} updated`);
  if (a.vendorsCreated) parts.push(`+${a.vendorsCreated} vendor${a.vendorsCreated > 1 ? "s" : ""}`);
  if (a.vendorsUpdated) parts.push(`${a.vendorsUpdated} vendor${a.vendorsUpdated > 1 ? "s" : ""} updated`);
  if (a.risksRaised) parts.push(`⚠ ${a.risksRaised} new risk${a.risksRaised > 1 ? "s" : ""}`);
  return parts.join(" · ");
}
