const fs = require("fs");
const axios = require("axios");
const pdfParse = require("pdf-parse");

exports.processRequirementDocument = async (req, res) => {
  try {
    const { url } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    let text = "";

    // Read text from the uploaded file
    if (file.mimetype === "text/plain") {
      text = fs.readFileSync(file.path, "utf-8");
    } else if (file.mimetype === "application/pdf") {
      const pdfData = await pdfParse(fs.readFileSync(file.path));
      text = pdfData.text;
    } else {
      return res.status(400).json({ error: "Unsupported file format." });
    }

    // Send extracted text to RAG model for feature extraction
    const response = await axios.post("http://localhost:8000/extract_features", {
      text,
    });

    res.json({ url, features: response.data.features });
  } catch (error) {
    console.error("Error processing file:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
