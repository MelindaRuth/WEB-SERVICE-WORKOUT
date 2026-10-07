/**
 * 404 NOT FOUND — dipasang PALING BAWAH di index.js (setelah semua router).
 * Kalau request sampai sini, tidak ada satu pun route yang cocok.
 * Untuk API, jawabannya JSON (bukan HTML "Cannot GET /xxx") karena
 * consumer kita adalah program.
 */
const notFound = (req, res) => {
  return res.status(404).json({
    status: "fail",
    message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan`,
  });
};

module.exports = notFound;
