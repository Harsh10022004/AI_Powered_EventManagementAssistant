const mongoose = require("mongoose");
const { CATEGORIES } = require("../config/constants");

const taskSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, enum: CATEGORIES, default: "other" },
    subEvent: { type: String, default: null }, // e.g. "Sangeet", "Reception", "Day 2"
    status: { type: String, enum: ["todo", "in_progress", "blocked", "done"], default: "todo" },
    priority: { type: String, enum: ["low", "medium", "high", "critical"], default: "medium" },
    dueDate: { type: Date, default: null },
    assignee: { type: String, default: null },
    // A task can depend on another (e.g. "confirm final guest count" blocks
    // "send catering headcount"). Used by the risk engine to flag chains
    // where an upstream task is late/blocked.
    dependsOn: { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
    notes: { type: String, default: "" },
    // Which conversation turn produced/last-touched this task — traceability.
    sourceMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    createdBy: { type: String, enum: ["ai", "manual"], default: "ai" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
