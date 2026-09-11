const mongoose = require("mongoose");

// A "sub-event" is a distinct function within the larger event, e.g. a
// Sangeet or Haldi ceremony inside a 3-day wedding, or Day 1 / Day 2 of a
// corporate outing. Kept as a light embedded list rather than its own
// collection because it is only ever read/written alongside its parent event.
const subEventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    date: { type: Date },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ["wedding", "corporate", "other"], default: "other" },
    startDate: { type: Date },
    endDate: { type: Date },
    guestCount: { type: Number, default: 0 },
    guestTravelCount: { type: Number, default: 0 }, // guests/attendees travelling from outside
    subEvents: { type: [subEventSchema], default: [] },
    status: { type: String, enum: ["planning", "active", "completed"], default: "planning" },
    // Free-text notes the AI extracts that don't map to a task/vendor/risk
    // (e.g. "catering needs final count 1 week before"). Kept for traceability.
    notes: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Event", eventSchema);
