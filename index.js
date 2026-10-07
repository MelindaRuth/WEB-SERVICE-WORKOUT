/**
 * TITIK MASUK APLIKASI — AI-Powered Workout & Habit Tracker
 * ========================================================
 *
 * File ini HANYA menyusun (CONTEXT.md §1): pasang middleware global, pasang
 * router, pasang penangkap di paling bawah, nyalakan server. Tidak ada
 * satu baris logika bisnis pun di sini.
 */
require("dotenv").config();

const express = require("express");
const app = express();

const logger = require("./src/middlewares/logger");
const notFound = require("./src/middlewares/notFound");
const errorHandler = require("./src/middlewares/errorHandler");
const {
  userRouter,
  exerciseRouter,
  workoutLogRouter,
  recommendationRouter,
} = require("./src/routes");
const { testConnection, syncDatabase } = require("./src/config/database");

const port = Number(process.env.PORT) || 3000;

/* ------------------------------------------------------------------ */
/* 1. MIDDLEWARE GLOBAL (urutan penting: dari atas ke bawah)           */
/* ------------------------------------------------------------------ */
app.use(express.json()); // req.body dari application/json
app.use(express.urlencoded({ extended: true })); // form urlencoded
app.use(logger); // catat method/path/status/durasi

/* ------------------------------------------------------------------ */
/* 2. ROUTER                                                           */
/* ------------------------------------------------------------------ */
// Informasi dasar service (bukan bagian dari kontrak API, hanya penanda hidup).
app.get("/", (req, res) =>
  res.json({
    service: "AI-Powered Workout & Habit Tracker",
    version: "1.0.0",
    endpoints: [
      "/api/v1/users",
      "/api/v1/users/:id/workout-logs",
      "/api/v1/exercises",
      "/api/v1/workout-logs",
      "/api/v1/workout-logs/:id",
      "/api/v1/workout-logs/statistik",
      "/api/v1/recommendations/generate",
    ],
  })
);

app.use("/api/v1/users", userRouter);
app.use("/api/v1/exercises", exerciseRouter);
app.use("/api/v1/workout-logs", workoutLogRouter);
app.use("/api/v1/recommendations", recommendationRouter);

/* ------------------------------------------------------------------ */
/* 3. PENANGKAP PALING BAWAH (HARUS setelah semua router)             */
/* ------------------------------------------------------------------ */
app.use(notFound); // tak ada route cocok          -> 404
app.use(errorHandler); // error tak tertangkap      -> 500 (atau sesuai err)

app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
  // Dites SETELAH server menyala: endpoint non-DB tetap bisa dipakai walau
  // MySQL belum siap.
  //   DB_AUTOSYNC=true (default dev) -> buat database + tabel bila belum ada.
  //   DB_AUTOSYNC=false             -> cukup cek koneksi, struktur DB urus
  //                                    lewat `npm run migrate` (sql/schema.sql).
  if (String(process.env.DB_AUTOSYNC).toLowerCase() === "false") {
    testConnection();
  } else {
    syncDatabase();
  }
});
