const axios = require("axios");

exports.generateAllSteps = (req, res) => {
    console.log("Received request to generate all test case steps:");
    console.log(req.body);
  
    res.json({ message: "Received all test cases", data: req.body });
  };
  
  exports.generateFeatureSteps = (req, res) => {
    console.log("Received request to generate steps for feature:", req.body.featureName);
    console.log(req.body);
  
    res.json({ message: `Received test cases for feature: ${req.body.featureName}`, data: req.body });
  };
  
  exports.generateTestCaseSteps = async (req, res) => {
    try {
        console.log("Received request to generate steps for test case:", req.body.testCase);
        
        const { testCaseName, recordedBy, actions } = req.body.testCase;

        if (!actions || actions.length === 0) {
            return res.status(400).json({ error: "No actions provided." });
        }

        // Call the RAG model API
        const response = await axios.post("http://localhost:8000/convert_flow", {
            flow: actions, // Sending the full flow to AI
        });

        // Extract generated test steps
        const testSteps = response.data.test_steps;
        console.log("TestSteps:",testSteps)

        return res.json({
            testCaseName,
            recordedBy,
            testSteps,
        });
    } catch (error) {
        console.error("Error generating test steps:", error);
        return res.status(500).json({ error: "Failed to generate test steps." });
    }
};
  