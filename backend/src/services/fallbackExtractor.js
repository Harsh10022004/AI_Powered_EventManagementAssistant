// ---------------------------------------------------------------------------
// Deterministic fallback used when GROQ_API_KEY is not set (or the Groq
// call fails). It doesn't try to be smart - it's a keyword/regex pass that
// keeps the app fully demoable end-to-end without any API key: numbers in
// the message update guestCount/guestTravelCount, and a short list of
// checklist keywords (venue, catering, decor, ...) creates a task per
// keyword found so the dashboard still visibly reacts to a message.
// Same output contract as aiService.extract, so the controller doesn't care
// which one produced it.
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS = {
  venue: ["venue"],
  catering: ["catering", "caterer", "food", "guest count", "headcount"],
  decor: ["decor", "décor", "decoration"],
  photography: ["photograph", "photographer", "videographer"],
  entertainment: ["entertainment", "dj", "band", "music"],
  accommodation: ["accommodation", "hotel", "stay"],
  transportation: ["transport", "transfer", "vehicle", "cab", "bus"],
  invitations: ["invitation", "invite"],
  branding: ["branding", "banner", "signage"],
  team_building: ["team-building", "team building", "activity", "activities"],
  leadership_session: ["leadership session", "ceo", "leadership"],
};

function extractNumber(text, patterns) {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

function extract({ message }) {
  const text = message.toLowerCase();

  const guestCount = extractNumber(text, [
    /for (?:approximately |around |about )?(\d+)\s*(?:guests|people|employees|attendees)/,
  ]);
  const guestTravelCount = extractNumber(text, [
    /(\d+)\s*(?:guests|people|employees)?\s*(?:will be|are)?\s*travelling/,
    /around (\d+)[^.]*travelling/,
  ]);

  const new_tasks = [];
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const hit = keywords.find((k) => text.includes(k));
    if (hit) {
      new_tasks.push({
        title: `Finalise ${category.replace("_", " ")}`,
        category,
        subEvent: "",
        priority: "medium",
        dueDate: "",
        notes: `Auto-detected from keyword "${hit}" (offline fallback mode - no AI key configured).`,
      });
    }
  }

  return {
    reply:
      "Logged (offline mode - no AI key configured, so this is a basic keyword pass; add GROQ_API_KEY for full understanding).",
    new_tasks,
    task_updates: [],
    new_vendors: [],
    vendor_updates: [],
    event_updates: {
      guestCount: guestCount ?? -1,
      guestTravelCount: guestTravelCount ?? -1,
      note: "",
    },
    detected_risks: [],
  };
}

module.exports = { extract };
