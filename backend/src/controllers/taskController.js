const Task = require("../models/Task");
const { asyncHandler } = require("../middleware/errorHandler");
const { loadOwnedEvent } = require("./eventController");

// Manual override endpoints - an event manager can always drag a card on the
// Kanban board or edit a field by hand; it doesn't all have to come through
// the chat. These sit alongside the AI pipeline, not instead of it.

const create = asyncHandler(async (req, res) => {
  const event = await loadOwnedEvent(req.params.eventId, req.userId);
  if (!event) return res.status(404).json({ error: "Event not found" });

  const task = await Task.create({ ...req.body, event: event._id, createdBy: "manual" });
  res.status(201).json({ task });
});

const update = asyncHandler(async (req, res) => {
  const event = await loadOwnedEvent(req.params.eventId, req.userId);
  if (!event) return res.status(404).json({ error: "Event not found" });

  const task = await Task.findOneAndUpdate(
    { _id: req.params.taskId, event: event._id },
    { $set: req.body },
    { new: true }
  );
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json({ task });
});

const remove = asyncHandler(async (req, res) => {
  const event = await loadOwnedEvent(req.params.eventId, req.userId);
  if (!event) return res.status(404).json({ error: "Event not found" });

  await Task.deleteOne({ _id: req.params.taskId, event: event._id });
  res.json({ ok: true });
});

module.exports = { create, update, remove };
