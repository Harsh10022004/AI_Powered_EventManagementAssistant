const Event = require("../models/Event");
const Task = require("../models/Task");
const Vendor = require("../models/Vendor");
const Risk = require("../models/Risk");
const Message = require("../models/Message");
const { asyncHandler } = require("../middleware/errorHandler");

const list = asyncHandler(async (req, res) => {
  const events = await Event.find({ owner: req.userId }).sort({ createdAt: -1 });
  res.json({ events });
});

const create = asyncHandler(async (req, res) => {
  const { title, type, startDate, endDate, guestCount, guestTravelCount, subEvents } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });

  const event = await Event.create({
    owner: req.userId,
    title,
    type: type || "other",
    startDate: startDate || null,
    endDate: endDate || null,
    guestCount: guestCount || 0,
    guestTravelCount: guestTravelCount || 0,
    subEvents: (subEvents || []).map((name) => ({ name })),
  });

  res.status(201).json({ event });
});

async function loadOwnedEvent(eventId, userId) {
  const event = await Event.findOne({ _id: eventId, owner: userId });
  return event;
}

const getOne = asyncHandler(async (req, res) => {
  const event = await loadOwnedEvent(req.params.id, req.userId);
  if (!event) return res.status(404).json({ error: "Event not found" });
  res.json({ event });
});

// Aggregated snapshot the dashboard renders in one call: overview stats +
// every task/vendor/risk/message for the event.
const dashboard = asyncHandler(async (req, res) => {
  const event = await loadOwnedEvent(req.params.id, req.userId);
  if (!event) return res.status(404).json({ error: "Event not found" });

  const [tasks, vendors, risks, messages] = await Promise.all([
    Task.find({ event: event._id }).sort({ dueDate: 1, createdAt: -1 }),
    Vendor.find({ event: event._id }).sort({ createdAt: -1 }),
    Risk.find({ event: event._id, status: { $ne: "resolved" } }).sort({ severity: -1, createdAt: -1 }),
    Message.find({ event: event._id }).sort({ createdAt: 1 }),
  ]);

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const daysToEvent = event.startDate
    ? Math.ceil((new Date(event.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  res.json({
    event,
    tasks,
    vendors,
    risks,
    messages,
    stats: {
      totalTasks,
      doneTasks,
      completionPct: totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0,
      openRisks: risks.length,
      criticalRisks: risks.filter((r) => r.severity === "critical").length,
      confirmedVendors: vendors.filter((v) => v.status === "confirmed").length,
      totalVendors: vendors.length,
      daysToEvent,
    },
  });
});

const remove = asyncHandler(async (req, res) => {
  const event = await loadOwnedEvent(req.params.id, req.userId);
  if (!event) return res.status(404).json({ error: "Event not found" });

  await Promise.all([
    Task.deleteMany({ event: event._id }),
    Vendor.deleteMany({ event: event._id }),
    Risk.deleteMany({ event: event._id }),
    Message.deleteMany({ event: event._id }),
    event.deleteOne(),
  ]);

  res.json({ ok: true });
});

module.exports = { list, create, getOne, dashboard, remove, loadOwnedEvent };
