/**
 * DAFTAR MODEL — UTS SOA
 * ======================
 *
 * Satu tempat yang membangun SEMUA model terhadap koneksi yang sama,
 * lalu MENYALAKAN semua relasi — pola persis seperti src/models/index.js
 * materi Minggu 4.
 *
 * Kenapa dua langkah (bangun dulu, relasi belakangan)?
 * `static associate(models)` merujuk model LAIN lewat nama
 * (User.hasMany(models.WorkoutLog, ...)). Kalau relasi dinyatakan saat
 * model masih dibangun satu per satu, model yang dirujuk bisa belum ada
 * -> error "Cannot read property 'WorkoutLog' of undefined" yang
 * membingungkan padahal penyebabnya cuma urutan.
 *
 * Maka: bangun SEMUA model dulu, baru jalankan SEMUA associate().
 *
 * Ringkasan relasi (RANCANGAN.md §2):
 *   User        1:N  WorkoutLog      (as: "workout_logs" / "user")
 *   WorkoutLog  N:M  Exercise        lewat pivot WorkoutDetail
 *                                     (as: "exercises" / "workout_logs",
 *                                      kolom pivot lewat "WorkoutDetail")
 *
 * Kalau menambah model baru:
 *   1. buat src/models/<Nama>.js
 *   2. require + daftarkan di objek `db` di bawah
 *   3. selesai — associate() model lain bisa langsung merujuknya.
 */
const db = {};

const { sequelize } = require("../config/database");

const User = require("./User");
const Exercise = require("./Exercise");
const WorkoutLog = require("./WorkoutLog");
const WorkoutDetail = require("./WorkoutDetail");

db.User = User(sequelize, sequelize.Sequelize);
db.Exercise = Exercise(sequelize, sequelize.Sequelize);
db.WorkoutLog = WorkoutLog(sequelize, sequelize.Sequelize);
db.WorkoutDetail = WorkoutDetail(sequelize, sequelize.Sequelize);

// Relasi dinyatakan SETELAH semua model ada. Urutan di objek `db`
// tidak penting; yang penting semua sudah terdaftar di baris atas.
for (const key of Object.keys(db)) {
  if (typeof db[key].associate === "function") {
    db[key].associate(db);
  }
}

db.sequelize = sequelize;
module.exports = db;
