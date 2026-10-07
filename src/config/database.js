/**
 * KONEKSI DATABASE (SEQUELIZE) — UTS SOA
 * ======================================
 *
 * Pola mengikuti src/databases/connection.js materi Minggu 4:
 * SATU instance Sequelize dibuat di sini, dipakai ulang oleh seluruh
 * aplikasi lewat src/models/index.js.
 *
 * - `dialect: "mysql"` — seluruh controller tetap portabel kalau nanti
 *   pindah database, cukup ganti dialect di satu tempat ini.
 * - Kredensial HANYA dibaca dari environment (.env lewat dotenv).
 *   Tidak ada nilai rahasia yang dituliskan di kode ini.
 * - `logging` masih menampilkan [SQL] selama tahap pengembangan —
 *   inilah alat bukti "bebas N+1" yang diminta RANCANGAN.md §8.
 *   WAJIB dimatikan sebelum produksi (butir 4 UTS: log tidak membocorkan SQL).
 */
require("dotenv").config();
const Sequelize = require("sequelize");

const DB_NAME = process.env.DB_NAME || "workout_tracker";

const sequelize = new Sequelize(
  DB_NAME,
  process.env.DB_USER || "root",
  process.env.DB_PASS || "",
  {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    dialect: "mysql",

    // Pool koneksi — versi ORM dari konfigurasi pool mysql2 Minggu 3.
    pool: {
      max: 10,     // maksimal 10 koneksi aktif bersamaan
      min: 0,      // boleh 0 koneksi saat sepi
      idle: 10000, // koneksi diam 10 detik dilepas
    },

    // Alat belajar & bukti N+1: cetak SQL ke terminal.
    // Matikan (false) saat sudah mendekati produksi.
    logging: (sql) => console.log("[SQL]", sql),
    // logging: false,

    define: {
      // Nama tabel ditentukan eksplisit per model lewat `tableName`,
      // tidak boleh disimpulkan otomatis dari nama model.
      freezeTableName: true,

      // Kolom kita memakai snake_case (created_at, updated_at, deleted_at).
      // `underscored: true` membuat Sequelize memetakan atribusi camelCase
      // internal ke kolom snake_case di MySQL.
      underscored: true,
    },
  }
);

/**
 * Dipanggil sekali saat server menyala (dari index.js).
 * Kalau kredensial salah atau MySQL belum jalan, ketahuan SEKARANG
 * lewat pesan yang jelas — bukan lewat error membingungkan di tengah
 * request pengguna.
 */
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log(`[DB] Terhubung ke MySQL "${DB_NAME}" (via Sequelize)`);
  } catch (err) {
    console.error("[DB] GAGAL terhubung ke MySQL:", err.message);
    console.error(
      "[DB] Periksa: MySQL sudah menyala? .env sudah benar? Database sudah dibuat?"
    );
    // Sengaja TIDAK process.exit() — alasan sama seperti materi Minggu 3/4.
  }
};

/* ------------------------------------------------------------------ */
/*  SYNC OTOMATIS (dev) — bikin tabel yang belum ada dari model.        */
/* ------------------------------------------------------------------ */
/**
 * Dib panggil saat server menyala bila DB_AUTOSYNC != "false".
 * `sequelize.sync()` TANPA force/alter = AMAN: hanya membuat tabel/kolom
 * yang belum ada, TIDAK pernah menghapus atau menimpa data.
 *
 * Supaya sync tahu semua model, module models/index.js WAJIB sudah ikut
 * ter-import sebelum fungsi ini dipanggil (index.js sudah melakukannya
 * lewat require router -> controller -> models).
 *
 * Alternatif produksi: buat tabel lewat sql/schema.sql (scripts/migrate.js),
 * lalu set DB_AUTOSYNC=false agar server tidak menyentuh struktur DB.
 */
const syncDatabase = async ({ force = false, alter = false } = {}) => {
  try {
    await ensureDatabaseExists(); // CREATE DATABASE IF NOT EXISTS (sync tak bisa bikin DB)
    require("../models"); // pastikan semua model terdaftar pada sequelize ini
    await sequelize.authenticate();
    await sequelize.sync({ force, alter });
    console.log(
      `[DB] Sync selesai (force=${force}, alter=${alter}) — tabel siap di "${DB_NAME}"`
    );
    return true;
  } catch (err) {
    console.error("[DB] Sync gagal:", err.message);
    console.error(
      "[DB] Kalau MySQL belum ada database-nya, jalankan: npm run migrate"
    );
    return false;
  }
};

/**
 * KONEKSI "ADMIN" TANPA MEMILIH DATABASE, hanya untuk memastikan database
 * target ada sebelum Sequelize menyambung ke dalamnya. `sync()` membuat TABEL,
 * bukan DATABASE — jadi langkah inilah yang membuat `npm start` lancar walau
 * MySQL masih benar-benar kosong.
 */
const ensureDatabaseExists = async () => {
  const mysql = require("mysql2/promise");
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    multipleStatements: true,
  });
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await conn.end();
};

module.exports = { sequelize, testConnection, syncDatabase, ensureDatabaseExists };