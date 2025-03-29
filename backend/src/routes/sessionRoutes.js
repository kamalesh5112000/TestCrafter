const express = require("express");
const router = express.Router();
const Session = require("../models/Session");

router.get("/check", async (req, res) => {
  const { sessionName } = req.query;

  if (!sessionName) {
    return res.status(400).json({ message: "Session name is required." });
  }

  const existingSession = await Session.findOne({ sessionName });
  res.json({ exists: !!existingSession });
});

module.exports = router;
