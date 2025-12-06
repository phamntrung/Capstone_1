// ========================================
// Routes xử lý các endpoint liên quan đến AI
// ========================================
const router = require("express").Router();
const aiController = require("../controllers/ai.controller");
const { authRequired } = require("../middleware/auth");

/**
 * Route xử lý chat với AI
 * POST /api/ai-new/
 * Yêu cầu: Authentication token
 */
router.post("/", authRequired, aiController.askAI);

// Export router để sử dụng trong server.js
module.exports = router;

