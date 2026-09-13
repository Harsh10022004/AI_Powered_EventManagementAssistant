const Groq = require("groq-sdk");
const { ExtractionSchema } = require("./extractionSchema");

// ---------------------------------------------------------------------------
// AI extraction pipeline (Groq).
//
// The model is not asked to "chat" - it's asked to read the new message plus
// a compact snapshot of the event's current state (existing tasks/vendors)
// and return a single JSON object matching the shape described in
// RESPONSE_SHAPE_DESCRIPTION below. Groq's OpenAI-compatible API supports a
// JSON mode (`response_format: { type: "json_object" }`) that guarantees the
// reply is syntactically valid JSON - unlike Gemini's `responseSchema`, Groq
// does not mechanically enforce the exact field shape, so the schema is
// spelled out explicitly in the system prompt instead, and every field is
// treated as optional/defaulted on the way in (see messageController.js's
// `hasValue` guard) so a missing or slightly-off field never crashes the
// pipeline - it's just treated as "no change".
//
// Two things the model is explicitly asked to do beyond plain entity
// extraction, because that's where "does this genuinely help an event
// manager" lives:
//   1. Decide UPDATE vs CREATE for tasks/vendors by matching against the
//      existing list we hand it (so "the sangeet venue is finalised" updates
//      an existing "Book Sangeet venue" task instead of creating a duplicate).
//   2. Propose `detected_risks` for judgement calls a rule can't make
//      (e.g. "photographer unavailable for reception" - free text, no
//      structured field to compare against).
// ---------------------------------------------------------------------------

let client = null;
function getClient() {
  if (!process.env.GROQ_API_KEY) return null;
  if (!client) client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return client;
}

const RESPONSE_SHAPE_DESCRIPTION = `Respond with ONLY a single JSON object (no markdown fences, no prose outside it) with exactly this shape:
{
  "reply": string,                     // 1-3 sentence reply to the event manager summarising what you understood/did
  "new_tasks": [
    {
      "title": string,
      "category": string,              // one of: venue, catering, decor, photography, entertainment, accommodation, transportation, invitations, branding, team_building, leadership_session, other
      "subEvent": string,               // e.g. "Sangeet", "Reception", "Day 1" - "" if not applicable
      "priority": string,              // one of: low, medium, high, critical
      "dueDate": string,                // ISO date YYYY-MM-DD if mentioned/inferable, else ""
      "notes": string
    }
  ],
  "task_updates": [                     // updates to tasks already listed in EXISTING_TASKS, matched by id
    { "id": string, "status": string, "notes": string }   // status one of: todo, in_progress, blocked, done - "" if unchanged
  ],
  "new_vendors": [
    {
      "name": string,
      "category": string,
      "status": string,                 // one of: not_started, contacted, negotiating, confirmed, cancelled
      "capacity": number,               // how many people this vendor can serve, 0 if unknown
      "notes": string
    }
  ],
  "vendor_updates": [                   // updates to vendors already listed in EXISTING_VENDORS, matched by id
    { "id": string, "status": string, "capacity": number, "notes": string }  // capacity: -1 if unchanged
  ],
  "event_updates": {
    "guestCount": number,               // -1 if unchanged
    "guestTravelCount": number,         // -1 if unchanged
    "note": string                      // any other useful fact to log, "" if none
  },
  "detected_risks": [                   // judgement-call risks only found via context - a separate rule engine already checks capacity/deadlines
    { "type": string, "severity": string, "description": string, "suggestedAction": string }  // type one of: scheduling_conflict, other; severity one of: low, medium, high, critical
  ]
}
Use "" / -1 / [] exactly as the "no change" sentinel for optional fields - never omit a top-level key.`;

const SYSTEM_INSTRUCTION = `You are the extraction engine behind an Event Management Assistant used by professional event managers.
Given a new message from the event manager and the current state of the event, extract structured changes.

Rules:
- Prefer updating an existing task/vendor (by id, from EXISTING_TASKS / EXISTING_VENDORS) over creating a duplicate when the message clearly refers to the same thing (e.g. "the sangeet venue has been finalised" updates a venue task, it does not create a new one).
- Only create new_tasks/new_vendors for things not already covered.
- Infer a reasonable category and priority even if not stated explicitly.
- Keep "reply" short (1-3 sentences), professional, and specific to what changed - like a sharp coordinator confirming they've logged something, not a generic chatbot.
- Do not invent numeric facts (guest counts, capacities) that are not in the message.
- Output must be valid JSON and nothing else.

${RESPONSE_SHAPE_DESCRIPTION}`;

function buildPrompt({ message, event, tasks, vendors }) {
  const taskLines = tasks
    .map((t) => `- id=${t._id} [${t.status}] (${t.category}${t.subEvent ? `/${t.subEvent}` : ""}) "${t.title}"${t.dueDate ? ` due ${t.dueDate.toISOString().slice(0, 10)}` : ""}`)
    .join("\n") || "(none yet)";
  const vendorLines = vendors
    .map((v) => `- id=${v._id} [${v.status}] (${v.category}) "${v.name}"${v.capacity != null ? ` capacity=${v.capacity}` : ""}`)
    .join("\n") || "(none yet)";

  return `EVENT: "${event.title}" (${event.type}), ${event.guestCount} guests, ${event.guestTravelCount || 0} travelling from outside.
Sub-events: ${event.subEvents.map((s) => s.name).join(", ") || "none"}.
Dates: ${event.startDate ? event.startDate.toISOString().slice(0, 10) : "TBD"} to ${event.endDate ? event.endDate.toISOString().slice(0, 10) : "TBD"}.

EXISTING_TASKS:
${taskLines}

EXISTING_VENDORS:
${vendorLines}

NEW MESSAGE FROM EVENT MANAGER:
"""${message}"""`;
}

/**
 * Calls Groq with JSON mode. Returns null if no API key is configured
 * (caller falls back to the rule-based extractor) or if the call fails or
 * returns unparseable JSON, so a missing/invalid key never breaks the chat.
 */
async function extract({ message, event, tasks, vendors }) {
  const groq = getClient();
  if (!groq) return null;

  try {
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: buildPrompt({ message, event, tasks, vendors }) },
      ],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) return null;

    const raw = JSON.parse(text);

    // Validate the AI's output against the schema the rest of the pipeline
    // expects, right here at the source - before a malformed field can reach
    // the database or crash a downstream loop. A failure here logs exactly
    // which field was wrong and falls back to the offline extractor, rather
    // than surfacing as a cryptic Mongoose validation error several steps
    // later.
    const result = ExtractionSchema.safeParse(raw);
    if (!result.success) {
      console.error("[aiService] Groq response failed schema validation, falling back:", result.error.issues);
      return null;
    }
    return result.data;
  } catch (err) {
    console.error("[aiService] Groq extraction failed, falling back:", err.message);
    return null;
  }
}

module.exports = { extract };
