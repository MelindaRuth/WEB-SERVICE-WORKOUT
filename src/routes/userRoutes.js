/**
 * ROUTES USER — /api/v1/users
 * ===========================
 *
 * Isi file ini HANYA "URL mana memanggil fungsi mana". Tidak ada `if`,
 * tidak ada `.filter()`, tidak ada logika bisnis (CONTEXT.md §1).
 * Urutan Express 5 sama: route spesifik/bersarang di atas route `/:id`.
 */
const express = require("express");
const router = express.Router();

const methodNotAllowed = require("../middlewares/methodNotAllowed");
const { validate, schemas } = require("../middlewares/validation");

const {
  registerUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} = require("../controllers/userController");
const { listUserWorkoutLogs } = require("../controllers/workoutLogController");

// "/"  -> GET daftar | POST registrasi (divalidasi lebih dulu)
router
  .route("/")
  .get(getAllUsers)
  .post(validate(schemas.userRegisterSchema), registerUser)
  .all(methodNotAllowed("GET", "POST"));

// NESTED RESOURCE: log latihan milik satu user.
//   GET /api/v1/users/:id/workout-logs
router
  .route("/:id/workout-logs")
  .get(listUserWorkoutLogs)
  .all(methodNotAllowed("GET"));

// "/:id" -> GET detail | PUT update | DELETE (soft)
router
  .route("/:id")
  .get(getUserById)
  .put(validate(schemas.userUpdateSchema), updateUser)
  .delete(deleteUser)
  .all(methodNotAllowed("GET", "PUT", "DELETE"));

module.exports = router;
