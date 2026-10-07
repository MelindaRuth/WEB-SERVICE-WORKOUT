/**
 * ROUTES WORKOUT LOG — /api/v1/workout-logs
 * =========================================
 * Nested list (di bawah /users/:id/workout-logs) ada di userRoutes; file
 * ini mengurus resource log itu sendiri.
 */
const express = require("express");
const router = express.Router();

const methodNotAllowed = require("../middlewares/methodNotAllowed");
const { validate, schemas } = require("../middlewares/validation");

const {
  createWorkoutLog,
  getWorkoutLogById,
  getStatistik,
} = require("../controllers/workoutLogController");

// "/" -> POST catat log (details ikut tervalidasi).
router
  .route("/")
  .post(validate(schemas.workoutLogCreateSchema), createWorkoutLog)
  .all(methodNotAllowed("POST"));

// "/statistik" WAJIB di atas "/:id": kalau tidak, GET /statistik dianggap
// id="statistik" dan mencocokkan .all() di route "/:id" -> 405 yang salah.
router
  .route("/statistik")
  .get(getStatistik)
  .all(methodNotAllowed("GET"));

// "/:id" -> GET detail (dengan include exercises + kolom pivot).
router
  .route("/:id")
  .get(getWorkoutLogById)
  .all(methodNotAllowed("GET"));

module.exports = router;
