const fs = require("fs");
const path = require("path");
const axios = require("axios");
const pdfParse = require("pdf-parse");

exports.processRequirementDocument = async (req, res) => {
  try {
    const { url } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    console.log("📄 File received:", file);

    const filePath = file.path;

    if (!fs.existsSync(filePath)) {
      console.error("❌ File not found at path:", filePath);
      return res.status(400).json({ error: "Uploaded file not found on server." });
    }

    let text = "";

    const fileBuffer = await fs.promises.readFile(filePath);

    if (file.mimetype === "text/plain") {
      text = fileBuffer.toString("utf-8");
    } else if (file.mimetype === "application/pdf") {
      const pdfData = await pdfParse(fileBuffer);
      text = pdfData.text;
    } else {
      return res.status(400).json({ error: "Unsupported file format." });
    }

    // Optional: delete file after reading
    fs.unlink(filePath, (err) => {
      if (err) console.warn("⚠️ Failed to delete uploaded file:", err);
      else console.log("🗑️ Uploaded file cleaned up.");
    });

    // Send extracted text to RAG model for feature extraction
    const response = await axios.post("http://localhost:8000/extract_features", {
      text,
    });

    res.json({ url, features: response.data.features });
  } catch (error) {
    console.error("❌ Error processing file:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
