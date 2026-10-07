/**
 * ROUTES RECOMMENDATION — /api/v1/recommendations
 * ===============================================
 * Integrasi Gemini (butir 5 UTS). Hanya satu aksi: generate.
 */
const express = require("express");
const router = express.Router();

const methodNotAllowed = require("../middlewares/methodNotAllowed");
const { validate, schemas } = require("../middlewares/validation");

const { generateRecommendation } = require("../controllers/recommendationController");

router
  .route("/generate")
  .post(validate(schemas.recommendationSchema), generateRecommendation)
  .all(methodNotAllowed("POST"));

module.exports = router;
