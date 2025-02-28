const express = require("express");
const router = express.Router();
const puppeteerController = require("../controllers/puppeteerController");

router.post("/launch", puppeteerController.launchBrowser);
router.post("/start-recording", puppeteerController.startRecording);
router.post("/stop-recording", puppeteerController.stopRecording);
router.get("/proxy/:userId", puppeteerController.getProxyPage);
router.get("/interactions/:userId", puppeteerController.getRecordedInteractions);
router.get("/current-url/:userId", puppeteerController.getCurrentURL);

module.exports = router;
