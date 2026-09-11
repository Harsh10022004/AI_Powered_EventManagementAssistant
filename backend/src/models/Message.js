const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    text: { type: String, required: true },
    // For assistant messages: a short structured record of what the AI
    // changed as a result of this turn, so the UI/README can show "why did
    // this task appear?" and trace it back to the exact message.
    actionsSummary: {
      tasksCreated: { type: Number, default: 0 },
      tasksUpdated: { type: Number, default: 0 },
      vendorsCreated: { type: Number, default: 0 },
      vendorsUpdated: { type: Number, default: 0 },
      risksRaised: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
