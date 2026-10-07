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

const {
  getAllExercises,
  createExercise,
  updateExercise,
  deleteExercise,
} = require("../controllers/exerciseController");

router
  .route("/")
  .get(getAllExercises)
  .post(validate(schemas.exerciseCreateSchema), createExercise)
  .all(methodNotAllowed("GET", "POST"));

router
  .route("/:id")
  .patch(validate(schemas.exerciseUpdateSchema), updateExercise)
  .delete(deleteExercise)
  .all(methodNotAllowed("PATCH", "DELETE"));

module.exports = router;
