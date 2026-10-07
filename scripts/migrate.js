/**
 * SCRIPT MIGRASI & SEED — `npm run migrate`
 * ==========================================
 *
 * Tiga langkah berurutan (pola sama seperti materi Minggu 3/4):
 *   1. CREATE DATABASE IF NOT EXISTS  -> database workout_tracker dibuat dulu
 *   2. jalankan sql/schema.sql        -> bangun tabel (DROP & CREATE ulang)
 *   3. jalankan sql/seed.sql          -> isi data awal
 *
 * Kenapa lewat Node, bukan `mysql < schema.sql`?
 * Supaya tidak wajib punya MySQL CLI ter-PATH. Cukup `npm install` lalu
 * `npm run migrate`. Kredensial dibaca dari .env (DB_PASS, dsb.).
 *
 * Mode:
 *   npm run migrate          -> schema + seed (reset penuh)
 *   npm run migrate schema   -> hanya schema (tanpa seed)
 *   npm run migrate seed     -> hanya seed (tabel harus sudah ada)
 */
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const DB_NAME = process.env.DB_NAME || "workout_tracker";
const mode = (process.argv[2] || "all").toLowerCase();

const bacaSql = (nama) =>
  fs.readFileSync(path.join(__dirname, "..", "sql", nama), "utf8");

const main = async () => {
  // Koneksi TANPA memilih database: kalau database belum ada, menyebutkan
  // namanya di koneksi awal akan gagal sebelum sempat membuatnya.
  const koneksi = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    multipleStatements: true, // WAJIB: schema & seed berisi banyak statement
  });

  try {
    console.log(`[migrate] Memastikan database "${DB_NAME}" ada...`);
    await koneksi.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await koneksi.query(`USE \`${DB_NAME}\``);

    if (mode === "all" || mode === "schema") {
      console.log("[migrate] Menjalankan sql/schema.sql...");
      await koneksi.query(bacaSql("schema.sql"));
    }

    if (mode === "all" || mode === "seed") {
      console.log("[migrate] Menjalankan sql/seed.sql...");
      await koneksi.query(bacaSql("seed.sql"));
    }

    console.log(`[migrate] Selesai (mode=${mode}). Database siap dipakai.`);
  } catch (err) {
    console.error("[migrate] GAGAL:", err.message);
    process.exitCode = 1;
  } finally {
    await koneksi.end();
  }
};

main();
