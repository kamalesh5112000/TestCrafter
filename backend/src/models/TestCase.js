const mongoose = require("mongoose");

const TestCaseSchema = new mongoose.Schema({
  featureId: { type: mongoose.Schema.Types.ObjectId, ref: "Feature", required: true },
  testCaseName: { type: String, required: true },
  testSteps: { type: String },
  recordedBy: { type: String, required: true },  // User-provided name
  actions: [
    {
      type: { type: String, required: true },
      tag: String,
      xpath: String,
      value: String,
      key: String,
      url: String,
      timestamp: { type: Date, default: Date.now }
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("TestCase", TestCaseSchema);
