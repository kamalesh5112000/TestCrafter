const express = require("express");
const { processRequirementDocument } = require("../controllers/ragController");
const { generateAllSteps, generateFeatureSteps, generateTestCaseSteps } = require("../controllers/generateController");
const multer = require("multer");


const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/upload", upload.single("file"), processRequirementDocument);


router.post("/all", generateAllSteps);
router.post("/feature", generateFeatureSteps);
router.post("/testcase", generateTestCaseSteps);

module.exports = router;
