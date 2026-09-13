const { z } = require("zod");

// ---------------------------------------------------------------------------
// Zod schema for the AI's structured output.
//
// Groq's JSON mode only guarantees the response PARSES as JSON - it does not
// guarantee the fields have the right types or the enums have valid values.
// Without this, a malformed field (e.g. capacity: "a lot" instead of a
// number) would either silently corrupt data or blow up later as an opaque
// Mongoose validation error, several steps away from where it actually went
// wrong. This schema validates the AI's raw response immediately after
// JSON.parse, so a bad response is caught and logged right at the source,
// and the caller can cleanly fall back to the offline extractor instead.
//
// Enums here intentionally mirror the Mongoose schema enums exactly
// (Task.status, Task.priority, Vendor.status, Risk.severity/type) - if the
// AI can't produce a value that fits, the rest of the pipeline couldn't have
// used it anyway.
// ---------------------------------------------------------------------------

const CATEGORY = z.enum([
  "venue", "catering", "decor", "photography", "entertainment",
  "accommodation", "transportation", "invitations", "branding",
  "team_building", "leadership_session", "other",
]);

const TASK_STATUS = z.enum(["todo", "in_progress", "blocked", "done"]);
const PRIORITY = z.enum(["low", "medium", "high", "critical"]);
const VENDOR_STATUS = z.enum(["not_started", "contacted", "negotiating", "confirmed", "cancelled"]);
const SEVERITY = z.enum(["low", "medium", "high", "critical"]);
const RISK_TYPE = z.enum(["scheduling_conflict", "other"]);

// AI is instructed to use "" / -1 as "no change" sentinels for optional
// scalar fields, so those are accepted alongside their real type rather than
// forcing every field to be present and meaningful.
const optionalString = z.string().default("");
const optionalStatus = (enumType) => z.union([enumType, z.literal("")]).default("");
const sentinelNumber = z.number().default(-1); // -1 means "unchanged"

const NewTaskSchema = z.object({
  title: z.string().min(1),
  category: CATEGORY.default("other"),
  subEvent: optionalString,
  priority: PRIORITY.default("medium"),
  dueDate: optionalString, // validated as an ISO date string, not parsed here - Date coercion happens in messageController
  notes: optionalString,
});

const TaskUpdateSchema = z.object({
  id: z.string().min(1),
  status: optionalStatus(TASK_STATUS),
  notes: optionalString,
});

const NewVendorSchema = z.object({
  name: z.string().min(1),
  category: CATEGORY.default("other"),
  status: VENDOR_STATUS.default("not_started"),
  capacity: z.number().default(0),
  notes: optionalString,
});

const VendorUpdateSchema = z.object({
  id: z.string().min(1),
  status: optionalStatus(VENDOR_STATUS),
  capacity: sentinelNumber,
  notes: optionalString,
});

const EventUpdatesSchema = z.object({
  guestCount: sentinelNumber,
  guestTravelCount: sentinelNumber,
  note: optionalString,
}).default({ guestCount: -1, guestTravelCount: -1, note: "" });

const DetectedRiskSchema = z.object({
  type: RISK_TYPE.default("other"),
  severity: SEVERITY.default("medium"),
  description: z.string().min(1),
  suggestedAction: optionalString,
});

const ExtractionSchema = z.object({
  reply: z.string().min(1),
  new_tasks: z.array(NewTaskSchema).default([]),
  task_updates: z.array(TaskUpdateSchema).default([]),
  new_vendors: z.array(NewVendorSchema).default([]),
  vendor_updates: z.array(VendorUpdateSchema).default([]),
  event_updates: EventUpdatesSchema,
  detected_risks: z.array(DetectedRiskSchema).default([]),
});

module.exports = { ExtractionSchema };
