/**
 * ROUTES EXERCISE — /api/v1/exercises
 * ===================================
 * Master data gerakan (dikelola Admin). List punya filter+sort+pagination
 * lewat query string (diproses controller dengan Op, bukan di sini).
 */
const express = require("express");
const router = express.Router();

const methodNotAllowed = require("../middlewares/methodNotAllowed");
const { validate, schemas } = require("../middlewares/validation");
const { requireAuth, requireAdmin } = require("../middlewares/auth");

const {
  getAllExercises,
  createExercise,
  updateExercise,
  deleteExercise,
} = require("../controllers/exerciseController");

router
  .route("/")
  .get(validate(schemas.exerciseQuerySchema, "query"), getAllExercises)
  .post(requireAuth, requireAdmin, validate(schemas.exerciseCreateSchema), createExercise)
  .all(methodNotAllowed("GET", "POST"));

router
  .route("/:id")
  .patch(requireAuth, requireAdmin, validate(schemas.exerciseUpdateSchema), updateExercise)
  .delete(requireAuth, requireAdmin, deleteExercise)
  .all(methodNotAllowed("PATCH", "DELETE"));

module.exports = router;
