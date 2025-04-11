const Session = require("../models/Session");
const Feature = require("../models/Feature");
const TestCase = require("../models/TestCase");

exports.storeActions = async (req, res) => {
  try {
    const { sessionName, feature, testCaseName, name, actions } = req.body;

    if (!sessionName || !feature || !testCaseName || !name || !Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({ message: "Invalid request data." });
    }

    // Check if session exists, else create a new one
    let session = await Session.findOne({ sessionName });
    if (!session) {
      session = new Session({ sessionName });
      await session.save();
    }

    // Check if feature exists under this session, else create a new one
    let featureDoc = await Feature.findOne({ sessionId: session._id, featureName: feature });
    if (!featureDoc) {
      featureDoc = new Feature({ sessionId: session._id, featureName: feature });
      await featureDoc.save();
    }

    // Create and save the test case under the feature
    const testCase = new TestCase({
      featureId: featureDoc._id,
      testCaseName,
      recordedBy: name,
      actions
    });

    await testCase.save();

    res.status(201).json({ message: "Test case stored successfully.", data: testCase });

  } catch (error) {
    console.error("Error storing actions:", error);
    res.status(500).json({ message: "Server error." });
  }
};

exports.fetchTestCases = async (req, res) => {
  try {
    const { sessionName } = req.params;

    if (!sessionName) {
      return res.status(400).json({ message: "Session name is required." });
    }

    // Find session
    const session = await Session.findOne({ sessionName });
    if (!session) {
      return res.status(404).json({ message: "Session not found." });
    }

    // Find features linked to session
    const features = await Feature.find({ sessionId: session._id });
    if (!features.length) {
      return res.status(404).json({ message: "No features found for this session." });
    }

    // Fetch test cases for each feature
    let testCases = {};
    for (const feature of features) {
      const cases = await TestCase.find({ featureId: feature._id });

      testCases[feature.featureName] = cases.map(testCase => ({
        testCaseId:testCase._id,
        testCaseName: testCase.testCaseName,
        recordedBy: testCase.recordedBy,
        actions: testCase.actions
      }));
    }

    res.status(200).json({ sessionName, testCases });

  } catch (error) {
    console.error("Error fetching test cases:", error);
    res.status(500).json({ message: "Server error." });
  }
};

exports.saveTestSteps = async (req, res) => {
  try {
    const { testCaseId, testSteps } = req.body;

    if (!testCaseId || !testSteps) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const testCase = await TestCase.findByIdAndUpdate(
      testCaseId,
      { $set: { testSteps } },
      { new: true }
    );
    console.log("testCase",testCase)

    if (!testCase) return res.status(404).json({ message: "Test case not found." });

    res.status(200).json({ message: "Test steps saved successfully.", data: testCase });
  } catch (error) {
    console.error("Error saving test steps:", error);
    res.status(500).json({ message: "Server error." });
  }
};

