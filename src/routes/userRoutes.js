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
  loginUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} = require("../controllers/userController");
const { listUserWorkoutLogs } = require("../controllers/workoutLogController");
const { refreshAccessToken } = require("../middlewares/auth");
const { requireAuth, requireAdmin } = require("../middlewares/auth");

// "/"  -> GET daftar | POST registrasi (divalidasi lebih dulu)
router
  .route("/")
  .get(requireAuth, requireAdmin, getAllUsers)
  .post(validate(schemas.userRegisterSchema), registerUser)
  .all(methodNotAllowed("GET", "POST"));

// LOGIN: `/login` WAJIB didaftarkan di atas `/:id`, kalau tidak kata "login"
// akan dianggap sebagai id user dan request ditolak (405/404).
//   POST /api/v1/users/login  { email, password }
router
  .route("/login")
  .post(validate(schemas.userLoginSchema), loginUser)
  .all(methodNotAllowed("POST"));

router
  .route("/refresh")
  .post(validate(schemas.authRefreshSchema), refreshAccessToken)
  .all(methodNotAllowed("POST"));

// NESTED RESOURCE: log latihan milik satu user.
//   GET /api/v1/users/:id/workout-logs
router
  .route("/:id/workout-logs")
  .get(validate(schemas.userWorkoutLogsQuerySchema, "query"), listUserWorkoutLogs)
  .all(methodNotAllowed("GET"));

// "/:id" -> GET detail | PUT update | DELETE (soft)
router
  .route("/:id")
  .get(getUserById)
  .put(requireAuth, validate(schemas.userUpdateSchema), updateUser)
  .delete(requireAuth, requireAdmin, deleteUser)
  .all(methodNotAllowed("GET", "PUT", "DELETE"));

module.exports = router;
