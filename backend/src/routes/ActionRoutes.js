const express = require("express");
const router = express.Router();
const actionController = require("../controllers/SaveController");

router.post("/store-actions", actionController.storeActions);
router.get("/:sessionName", actionController.fetchTestCases);
module.exports = router;
