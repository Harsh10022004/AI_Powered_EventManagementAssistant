const mongoose = require("mongoose");
const { CATEGORIES } = require("../config/constants");

const vendorSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: CATEGORIES, default: "other" },
    status: {
      type: String,
      enum: ["not_started", "contacted", "negotiating", "confirmed", "cancelled"],
      default: "not_started",
    },
    // How many people this vendor can serve — the key number the risk engine
    // compares against guest count / travelling count (e.g. transport
    // vehicles for 150 vs. 200 attendees).
    capacity: { type: Number, default: null },
    contact: { type: String, default: "" },
    notes: { type: String, default: "" },
    sourceMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vendor", vendorSchema);
