const mongoose = require("mongoose");

const TestCaseSchema = new mongoose.Schema({
    page: String,
    action: String,
    element: String,
    value: String,
    timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("TestCase", TestCaseSchema);
