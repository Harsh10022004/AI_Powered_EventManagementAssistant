const mongoose = require("mongoose");

const RISK_TYPES = [
  "capacity_mismatch",   // vendor can't serve the number of people needing it
  "deadline_risk",       // task due soon but not done/confirmed
  "missing_vendor",      // checklist category has no vendor at all
  "dependency_block",    // a task is blocked on an upstream task that's late
  "scheduling_conflict", // AI-detected clash (e.g. unavailable vendor, overlapping slots)
  "other",
];

const riskSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    type: { type: String, enum: RISK_TYPES, required: true },
    severity: { type: String, enum: ["low", "medium", "high", "critical"], default: "medium" },
    description: { type: String, required: true },
    suggestedAction: { type: String, default: "" },
    relatedTask: { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
    relatedVendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", default: null },
    status: { type: String, enum: ["open", "acknowledged", "resolved"], default: "open" },
    // "rule_engine" = deterministic check (always reproducible, explainable).
    // "ai" = surfaced by the LLM from free-text context that rules can't parse.
    source: { type: String, enum: ["rule_engine", "ai"], required: true },
    // Deterministic key used to upsert/de-duplicate a rule-engine risk across
    // re-evaluations, e.g. "capacity_mismatch:transportation". Without this,
    // every message would re-raise a fresh duplicate risk for the same issue.
    dedupeKey: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Risk", riskSchema);
