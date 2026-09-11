const mongoose = require("mongoose");
const Message = require("../models/Message");
const Task = require("../models/Task");
const Vendor = require("../models/Vendor");
const Event = require("../models/Event");
const { asyncHandler } = require("../middleware/errorHandler");
const { loadOwnedEvent } = require("./eventController");
const aiService = require("../services/aiService");
const fallbackExtractor = require("../services/fallbackExtractor");
const riskEngine = require("../services/riskEngine");

const list = asyncHandler(async (req, res) => {
  const event = await loadOwnedEvent(req.params.eventId, req.userId);
  if (!event) return res.status(404).json({ error: "Event not found" });

  const messages = await Message.find({ event: event._id }).sort({ createdAt: 1 });
  res.json({ messages });
});

// Converts a -1/"" sentinel field from the AI schema into "no change".
const hasValue = (v) => v !== undefined && v !== null && v !== "" && v !== -1;

/**
 * The central pipeline: user message in -> structured diff applied to the
 * DB -> risk engine re-evaluated -> assistant reply + full dashboard delta
 * out. This is the one place conversation turns into state.
 */
const create = asyncHandler(async (req, res) => {
  const event = await loadOwnedEvent(req.params.eventId, req.userId);
  if (!event) return res.status(404).json({ error: "Event not found" });

  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: "text is required" });

  const userMessage = await Message.create({ event: event._id, role: "user", text: text.trim() });

  const [existingTasks, existingVendors] = await Promise.all([
    Task.find({ event: event._id }),
    Vendor.find({ event: event._id }),
  ]);

  // Try the real AI extractor first; fall back to the offline keyword
  // extractor if no API key is configured or the call fails, so the chat
  // never dead-ends.
  let extraction = await aiService.extract({ message: text, event, tasks: existingTasks, vendors: existingVendors });
  let usedFallback = false;
  if (!extraction) {
    extraction = fallbackExtractor.extract({ message: text });
    usedFallback = true;
  }

  const summary = { tasksCreated: 0, tasksUpdated: 0, vendorsCreated: 0, vendorsUpdated: 0, risksRaised: 0 };

  // --- apply task diffs ---------------------------------------------------
  for (const t of extraction.new_tasks || []) {
    await Task.create({
      event: event._id,
      title: t.title,
      category: t.category || "other",
      subEvent: t.subEvent || null,
      priority: t.priority || "medium",
      dueDate: hasValue(t.dueDate) ? new Date(t.dueDate) : null,
      notes: t.notes || "",
      sourceMessage: userMessage._id,
      createdBy: "ai",
    });
    summary.tasksCreated += 1;
  }

  for (const u of extraction.task_updates || []) {
    if (!mongoose.isValidObjectId(u.id)) continue;
    const set = { sourceMessage: userMessage._id };
    if (hasValue(u.status)) set.status = u.status;
    if (hasValue(u.notes)) set.notes = u.notes;
    const result = await Task.updateOne({ _id: u.id, event: event._id }, { $set: set });
    if (result.matchedCount) summary.tasksUpdated += 1;
  }

  // --- apply vendor diffs --------------------------------------------------
  for (const v of extraction.new_vendors || []) {
    await Vendor.create({
      event: event._id,
      name: v.name,
      category: v.category || "other",
      status: v.status || "not_started",
      capacity: hasValue(v.capacity) ? v.capacity : null,
      notes: v.notes || "",
      sourceMessage: userMessage._id,
    });
    summary.vendorsCreated += 1;
  }

  for (const u of extraction.vendor_updates || []) {
    if (!mongoose.isValidObjectId(u.id)) continue;
    const set = { sourceMessage: userMessage._id };
    if (hasValue(u.status)) set.status = u.status;
    if (hasValue(u.capacity)) set.capacity = u.capacity;
    if (hasValue(u.notes)) set.notes = u.notes;
    const result = await Vendor.updateOne({ _id: u.id, event: event._id }, { $set: set });
    if (result.matchedCount) summary.vendorsUpdated += 1;
  }

  // --- apply event-level diffs ----------------------------------------------
  const eventSet = {};
  if (extraction.event_updates) {
    if (hasValue(extraction.event_updates.guestCount)) eventSet.guestCount = extraction.event_updates.guestCount;
    if (hasValue(extraction.event_updates.guestTravelCount)) eventSet.guestTravelCount = extraction.event_updates.guestTravelCount;
    if (hasValue(extraction.event_updates.note)) {
      await Event.updateOne({ _id: event._id }, { $push: { notes: extraction.event_updates.note } });
    }
  }
  if (Object.keys(eventSet).length) {
    await Event.updateOne({ _id: event._id }, { $set: eventSet });
  }

  // --- re-evaluate risk engine on the fresh state ---------------------------
  const [freshEvent, freshTasks, freshVendors] = await Promise.all([
    Event.findById(event._id),
    Task.find({ event: event._id }),
    Vendor.find({ event: event._id }),
  ]);
  const risks = await riskEngine.evaluateEvent(freshEvent, freshTasks, freshVendors, extraction.detected_risks || []);
  summary.risksRaised = risks.filter((r) => r.status === "open" && r.createdAt >= userMessage.createdAt).length;

  const assistantMessage = await Message.create({
    event: event._id,
    role: "assistant",
    text: usedFallback
      ? `${extraction.reply}`
      : extraction.reply || "Got it - I've updated the dashboard.",
    actionsSummary: summary,
  });

  res.status(201).json({
    userMessage,
    assistantMessage,
    diff: summary,
    usedFallback,
    // Full fresh snapshots so the frontend can just replace state - simpler
    // and more consistent than reasoning about partial patches on the client.
    event: freshEvent,
    tasks: freshTasks,
    vendors: freshVendors,
    risks,
  });
});

module.exports = { list, create };
