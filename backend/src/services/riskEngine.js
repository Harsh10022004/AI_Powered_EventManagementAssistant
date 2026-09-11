const Risk = require("../models/Risk");

// ---------------------------------------------------------------------------
// Deterministic risk engine.
//
// Why this exists alongside the AI: an LLM is good at reading free text and
// proposing *candidate* risks, but it is not reliable for arithmetic or for
// re-checking the same condition consistently turn after turn. So every
// piece of "hard" logic - capacity math, deadline countdowns, missing
// checklist items, blocked dependency chains - is implemented here as plain
// code the interviewer can read top to bottom and trust. The AI is only
// responsible for the *unstructured* judgement call (scheduling clashes
// buried in prose), and is clearly labelled `source: "ai"` when it raises one.
//
// The engine is idempotent: it is re-run after every conversation turn and
// upserts risks by a `dedupeKey`, so re-running it never creates duplicates,
// and a risk whose condition is no longer true gets auto-resolved.
// ---------------------------------------------------------------------------

const DEADLINE_WARNING_DAYS = 5;

function daysFromNow(date) {
  const ms = new Date(date).getTime() - Date.now();
  return ms / (1000 * 60 * 60 * 24);
}

/**
 * Evaluate every rule for one event and reconcile the Risk collection so it
 * exactly reflects the current set of true conditions.
 * @returns {Promise<Array>} the open risks after reconciliation
 */
async function evaluateEvent(event, tasks, vendors, aiRisks = []) {
  const candidates = []; // { type, severity, description, suggestedAction, relatedTask, relatedVendor, dedupeKey }

  // --- Rule 1: capacity mismatch -------------------------------------------------
  // A vendor's stated capacity is less than the number of people who need it.
  // Transportation/accommodation are compared against guestTravelCount (people
  // coming from outside); everything else against the full guestCount.
  const travelDependentCategories = new Set(["transportation", "accommodation"]);
  for (const vendor of vendors) {
    if (vendor.capacity == null || vendor.status === "cancelled") continue;
    const relevantCount = travelDependentCategories.has(vendor.category)
      ? event.guestTravelCount || event.guestCount
      : event.guestCount;
    if (relevantCount > 0 && vendor.capacity < relevantCount) {
      candidates.push({
        type: "capacity_mismatch",
        severity: vendor.capacity < relevantCount * 0.7 ? "critical" : "high",
        description: `${vendor.name} (${vendor.category}) can only serve ${vendor.capacity} people, but ${relevantCount} are expected to need it.`,
        suggestedAction: `Book a supplementary ${vendor.category} vendor for the remaining ${relevantCount - vendor.capacity} people, or renegotiate capacity with ${vendor.name}.`,
        relatedVendor: vendor._id,
        dedupeKey: `capacity_mismatch:${vendor._id}`,
      });
    }
  }

  // --- Rule 2: deadline risk ------------------------------------------------------
  // A task is due within DEADLINE_WARNING_DAYS (or already overdue) and isn't done.
  for (const task of tasks) {
    if (!task.dueDate || task.status === "done") continue;
    const days = daysFromNow(task.dueDate);
    if (days <= DEADLINE_WARNING_DAYS) {
      const overdue = days < 0;
      candidates.push({
        type: "deadline_risk",
        severity: overdue ? "critical" : days <= 2 ? "high" : "medium",
        description: overdue
          ? `"${task.title}" was due ${Math.abs(Math.round(days))} day(s) ago and is still "${task.status}".`
          : `"${task.title}" is due in ${Math.ceil(days)} day(s) and is still "${task.status}".`,
        suggestedAction: overdue
          ? `Follow up immediately or reassign "${task.title}" - it has already missed its deadline.`
          : `Prioritise "${task.title}" this week to stay on schedule.`,
        relatedTask: task._id,
        dedupeKey: `deadline_risk:${task._id}`,
      });
    }
  }

  // --- Rule 3: missing vendor for a category with open tasks -----------------------
  // If tasks exist in a category (e.g. "decor") but no vendor has been
  // confirmed for that category as the event approaches, flag it.
  const daysToEvent = event.startDate ? daysFromNow(event.startDate) : null;
  if (daysToEvent !== null && daysToEvent <= 21) {
    const categoriesWithTasks = new Set(tasks.map((t) => t.category).filter((c) => c !== "other"));
    const confirmedCategories = new Set(
      vendors.filter((v) => v.status === "confirmed").map((v) => v.category)
    );
    for (const category of categoriesWithTasks) {
      if (!confirmedCategories.has(category)) {
        candidates.push({
          type: "missing_vendor",
          severity: daysToEvent <= 7 ? "critical" : "high",
          description: `No confirmed vendor for "${category}" and the event is ${Math.ceil(daysToEvent)} day(s) away.`,
          suggestedAction: `Shortlist and confirm a ${category} vendor as a priority.`,
          dedupeKey: `missing_vendor:${category}`,
        });
      }
    }
  }

  // --- Rule 4: dependency block ----------------------------------------------------
  // A task depends on another task that is not done, but the dependent task
  // is due soon (i.e. the chain is about to break).
  const taskById = new Map(tasks.map((t) => [t._id.toString(), t]));
  for (const task of tasks) {
    if (!task.dependsOn || task.status === "done") continue;
    const upstream = taskById.get(task.dependsOn.toString());
    if (upstream && upstream.status !== "done") {
      const daysLeft = task.dueDate ? daysFromNow(task.dueDate) : Infinity;
      if (daysLeft <= DEADLINE_WARNING_DAYS * 2) {
        candidates.push({
          type: "dependency_block",
          severity: daysLeft <= DEADLINE_WARNING_DAYS ? "critical" : "medium",
          description: `"${task.title}" is blocked on "${upstream.title}", which is still "${upstream.status}".`,
          suggestedAction: `Resolve "${upstream.title}" first - it is holding up "${task.title}".`,
          relatedTask: task._id,
          dedupeKey: `dependency_block:${task._id}`,
        });
      }
    }
  }

  return reconcile(event._id, candidates, aiRisks);
}

// Merge deterministic `candidates` (this run's truth) with an AI-raised risk
// list, then diff against what's already stored: create new ones, resolve
// ones no longer true, leave untouched ones alone (so a human's manual
// "acknowledged" status on a still-valid risk isn't clobbered every turn).
async function reconcile(eventId, candidates, aiRisks = []) {
  const aiCandidates = aiRisks.map((r) => ({
    ...r,
    source: "ai",
    dedupeKey: `ai:${r.type}:${(r.description || "").slice(0, 60)}`,
  }));
  const allCandidates = [
    ...candidates.map((c) => ({ ...c, source: "rule_engine" })),
    ...aiCandidates,
  ];

  const existing = await Risk.find({ event: eventId, status: { $ne: "resolved" } });
  const existingByKey = new Map(existing.map((r) => [r.dedupeKey, r]));
  const candidateKeys = new Set(allCandidates.map((c) => c.dedupeKey));

  // Auto-resolve rule-engine risks whose condition is no longer true.
  // AI risks are left for a human to dismiss, since we can't re-verify them
  // deterministically.
  const toResolve = existing.filter(
    (r) => r.source === "rule_engine" && !candidateKeys.has(r.dedupeKey)
  );
  if (toResolve.length) {
    await Risk.updateMany(
      { _id: { $in: toResolve.map((r) => r._id) } },
      { $set: { status: "resolved" } }
    );
  }

  // Upsert (create if new, otherwise leave the existing doc/status as is).
  for (const candidate of allCandidates) {
    if (!existingByKey.has(candidate.dedupeKey)) {
      await Risk.create({ event: eventId, status: "open", ...candidate });
    }
  }

  return Risk.find({ event: eventId, status: { $ne: "resolved" } }).sort({ severity: -1, createdAt: -1 });
}

module.exports = { evaluateEvent, reconcile };
