const Vendor = require("../models/Vendor");
const { asyncHandler } = require("../middleware/errorHandler");
const { loadOwnedEvent } = require("./eventController");

const create = asyncHandler(async (req, res) => {
  const event = await loadOwnedEvent(req.params.eventId, req.userId);
  if (!event) return res.status(404).json({ error: "Event not found" });

  const vendor = await Vendor.create({ ...req.body, event: event._id });
  res.status(201).json({ vendor });
});

const update = asyncHandler(async (req, res) => {
  const event = await loadOwnedEvent(req.params.eventId, req.userId);
  if (!event) return res.status(404).json({ error: "Event not found" });

  const vendor = await Vendor.findOneAndUpdate(
    { _id: req.params.vendorId, event: event._id },
    { $set: req.body },
    { new: true }
  );
  if (!vendor) return res.status(404).json({ error: "Vendor not found" });
  res.json({ vendor });
});

const remove = asyncHandler(async (req, res) => {
  const event = await loadOwnedEvent(req.params.eventId, req.userId);
  if (!event) return res.status(404).json({ error: "Event not found" });

  await Vendor.deleteOne({ _id: req.params.vendorId, event: event._id });
  res.json({ ok: true });
});

module.exports = { create, update, remove };
