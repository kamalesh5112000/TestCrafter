import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const ViewTestCases = ({ sessionName }) => {
  const navigate = useNavigate();
  const [testCases, setTestCases] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [generatedSteps, setGeneratedSteps] = useState({});
  const [editedSteps, setEditedSteps] = useState({});
  const [loadingSteps, setLoadingSteps] = useState({});

  useEffect(() => {
    if (!sessionName) {
      setError("No session name provided.");
      setLoading(false);
      return;
    }

    const fetchTestCases = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/actions/${sessionName}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to fetch test cases.");
        console.log("testcases:",data)
        setTestCases(data.testCases);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchTestCases();
  }, [sessionName]);

  const generateSteps = async (type, data) => {
    let url = "";
    let body = {};
    const testCaseName = data.testCaseName;

    // Set loading true for this test case
    setLoadingSteps((prev) => ({ ...prev, [testCaseName]: true }));

    if (type === "all") {
      url = "http://localhost:5000/api/rag/all";
      body = { testCases: data };
    } else if (type === "feature") {
      url = "http://localhost:5000/api/rag/feature";
      body = { featureName: data, testCases: testCases[data] };
    } else if (type === "testCase") {
      url = "http://localhost:5000/api/rag/testcase";
      body = { testCase: data };
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      setGeneratedSteps((prev) => ({
        ...prev,
        [testCaseName]: result.testSteps,
      }));

      setEditedSteps((prev) => ({
        ...prev,
        [testCaseName]: result.testSteps,
      }));
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      // Clear loading state
      setLoadingSteps((prev) => ({ ...prev, [testCaseName]: false }));
    }
  };


  const handleSaveSteps = async (testCase) => {
    const testSteps = editedSteps[testCase.testCaseName];
  
    try {
      const response = await fetch("http://localhost:5000/api/actions/save-steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testCaseId: testCase.testCaseId,
          testSteps
        }),
      });
  
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
  
      alert("Steps saved!");
    } catch (err) {
      console.error("Error saving steps:", err);
      alert("Failed to save steps: " + err.message);
    }
  };
  
  

  if (loading) return <div className="text-center text-gray-600">Loading test cases...</div>;
  if (error) return <div className="text-center text-red-500">{error}</div>;

  return (
    <div className="flex h-screen w-screen">
      {/* Sidebar - Feature List */}
      <div className="w-1/4 bg-gray-100 p-4 shadow-lg flex flex-col">
        <button
          onClick={() => navigate("/")}
          className="mb-4 px-6 py-2 bg-red-500 text-white rounded hover:bg-red-600 shadow-lg"
        >
          Back to Home
        </button>
        <h2 className="text-lg font-semibold mb-4">Features</h2>
        <div className="flex-1 overflow-y-auto">
          <ul>
            {Object.keys(testCases).map((feature, index) => (
              <li
                key={index}
                onClick={() => setSelectedFeature(feature)}
                className={`p-2 mb-2 cursor-pointer rounded-lg transition ${selectedFeature === feature
                    ? "bg-blue-500 text-white"
                    : "bg-white text-gray-800 hover:bg-gray-200"
                  }`}
              >
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Main Panel - Test Cases Display */}
      <div className="w-3/4 p-6 flex flex-col">
        {selectedFeature ? (
          <div className="flex flex-col h-full">
            {/* Fixed Header */}
            <div className="flex justify-between items-center mb-4 bg-white p-4 shadow-md rounded-lg">
              <h2 className="text-2xl font-semibold text-gray-800">
                {selectedFeature} - Test Cases
              </h2>
            </div>

            {/* Scrollable Test Cases List */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              {testCases[selectedFeature]?.map((testCase, index) => (
                <div key={index} className="border rounded-lg shadow-md p-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-800">Test Case {index + 1}</h3>
                    <button
                      onClick={() => generateSteps("testCase", testCase)}
                      className={`px-3 py-1 text-white rounded ${loadingSteps[testCase.testCaseName]
                          ? "bg-blue-300 cursor-not-allowed"
                          : "bg-blue-500 hover:bg-blue-600"
                        }`}
                      disabled={loadingSteps[testCase.testCaseName]}
                    >
                      {loadingSteps[testCase.testCaseName] ? "Generating..." : "Generate Steps"}
                    </button>
                  </div>

                  <ul className="mt-2 text-gray-600">
                    {testCase.actions.map((action, i) => (
                      <li key={i} className="p-2 bg-gray-100 rounded-md mb-1">
                        {action.type === "navigation"
                          ? `navigation - ${action.url}`
                          : `${action.type} - ${action.xpath}`}
                      </li>
                    ))}
                  </ul>

                  {/* Show Textarea after steps are generated */}
                  {generatedSteps[testCase.testCaseName] && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Generated Steps:
                      </label>
                      <textarea
                        className="w-full h-40 p-2 border rounded-md text-sm"
                        value={editedSteps[testCase.testCaseName] || ""}
                        onChange={(e) =>
                          setEditedSteps((prev) => ({
                            ...prev,
                            [testCase.testCaseName]: e.target.value,
                          }))
                        }
                      />
                      <div className="text-right mt-2">
                        <button
                          onClick={() => handleSaveSteps(testCase)}
                          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                        >
                          Save Steps
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-lg">Select a feature to view test cases.</p>
        )}
      </div>
    </div>
  );
};

export default ViewTestCases;
