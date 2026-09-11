const Risk = require("../models/Risk");
const { asyncHandler } = require("../middleware/errorHandler");
const { loadOwnedEvent } = require("./eventController");

// Risks are otherwise system-generated; the only manual action a human takes
// is changing status (acknowledge it / mark resolved after acting on it).
const update = asyncHandler(async (req, res) => {
  const event = await loadOwnedEvent(req.params.eventId, req.userId);
  if (!event) return res.status(404).json({ error: "Event not found" });

  const { status } = req.body;
  if (!["open", "acknowledged", "resolved"].includes(status)) {
    return res.status(400).json({ error: "status must be one of: open, acknowledged, resolved" });
  }

  const risk = await Risk.findOneAndUpdate(
    { _id: req.params.riskId, event: event._id },
    { $set: { status } },
    { new: true }
  );
  if (!risk) return res.status(404).json({ error: "Risk not found" });
  res.json({ risk });
});

module.exports = { update };
