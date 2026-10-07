/**
 * ERROR HANDLER TERPUSAT — UTS SOA
 * ================================
 *
 * Express mengenali error handler HANYA kalau parameternya EMPAT:
 * (err, req, res, next). Dipasang paling bawah, setelah notFound.
 *
 * Tugas utamanya (butir 4 UTS): JANGAN pernah membocorkan stack trace,
 * nama tabel, atau query SQL ke client. Detail lengkap masuk ke LOG
 * server; client hanya menerima pesan yang aman & konsisten.
 *
 * Format response seragam untuk semua error:
 *   { status: 'fail' | 'error', message: '...', errors?: {...} }
 */

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // 1) Detail LENGKAP ke log server — ini yang boleh berisi stack/SQL.
  console.error("[ERROR]", err.stack || err.message || err);

  // 2) Body JSON rusak (dilempar express.json()). Dicek PALING AWAL supaya
  //    pesan parser mentah ("Expected property name...") tidak ikut ke
  //    klien — diganti pesan aman.
  if (err.type === "entity.parse.failed") {
    return res
      .status(400)
      .json({ status: "fail", message: "Body permintaan bukan JSON yang valid" });
  }

  // 3) Error yang sengaja diberi status oleh controller/middleware
  //    (mis. 404/409 lewat `next(Object.assign(new Error(), {statusCode}))`).
  const status = err.statusCode || err.status;
  if (status && status >= 400 && status < 600) {
    return res.status(status).json({
      status: status >= 500 ? "error" : "fail",
      message: err.expose ? err.message : genericFor(status),
      ...(err.errors ? { errors: err.errors } : {}),
    });
  }

  // 4) Error khas Sequelize — diterjemahkan ke status yang tepat.
  switch (err.name) {
    case "SequelizeValidationError":
      // Validasi level model (lapis kedua) lolos dari Joi: laporkan per field.
      return res.status(400).json({
        status: "fail",
        message: "Validasi gagal",
        errors: mapSequelizeValidation(err),
      });

    case "SequelizeUniqueConstraintError":
      // UNIQUE KEY dilanggar (race condition dua POST bersamaan).
      return res.status(409).json({
        status: "fail",
        message: "Data dengan nilai unik tersebut sudah terdaftar",
      });

    case "SequelizeForeignKeyConstraintError":
    case "SequelizeConstraintError":
      // Baris masih dirujuk tabel lain -> konflik aturan bisnis.
      return res.status(409).json({
        status: "fail",
        message: "Data tidak dapat dihapus karena masih dipakai data lain",
      });

    default:
      break;
  }

  // 5) Masalah koneksi database -> 503 (bukan 500, dan TANPA bocorkan detail).
  if (
    err.code === "ECONNREFUSED" ||
    err.code === "PROTOCOL_CONNECTION_LOST" ||
    err.name === "SequelizeConnectionRefusedError"
  ) {
    console.error("[ERROR] Koneksi MySQL bermasalah. MySQL menyala? `.env` benar?");
    return res
      .status(503)
      .json({ status: "error", message: "Database sedang tidak dapat dihubungi" });
  }

  // 6) Sisanya -> 500 generik. Pesan client SENGAJA kabur.
  return res
    .status(500)
    .json({ status: "error", message: "Terjadi kesalahan pada server" });
};

/** Pesan aman per status (tanpa detail internal). */
function genericFor(status) {
  switch (status) {
    case 400:
      return "Permintaan tidak valid";
    case 404:
      return "Data tidak ditemukan";
    case 405:
      return "Method tidak diizinkan untuk jalur ini";
    case 409:
      return "Konflik dengan aturan bisnis";
    default:
      return "Terjadi kesalahan pada server";
  }
}

/** Rapikan error validasi model menjadi { field: [pesan] }. */
function mapSequelizeValidation(err) {
  const errors = {};
  for (const e of err.errors || []) {
    const field = e.path || "_model";
    if (!errors[field]) errors[field] = [];
    errors[field].push(e.message);
  }
  return errors;
}

module.exports = errorHandler;
