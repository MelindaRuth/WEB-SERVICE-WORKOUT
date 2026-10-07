/**
 * Satu pintu ekspor untuk semua router, supaya index.js tinggal require
 * sekali (pola sama seperti src/routes/index.js materi kelas).
 */
const userRouter = require("./userRoutes");
const exerciseRouter = require("./exerciseRoutes");
const workoutLogRouter = require("./workoutLogRoutes");
const recommendationRouter = require("./recommendationRoutes");

module.exports = {
  userRouter,
  exerciseRouter,
  workoutLogRouter,
  recommendationRouter,
};
