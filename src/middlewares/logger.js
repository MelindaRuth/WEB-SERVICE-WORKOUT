/**
 * Logger request sederhana (req, res, next).
 * Mencatat method, path, status code, dan durasi SETELAH response dikirim.
 * Aturan middleware: panggil next() ATAU kirim response — jangan diam.
 */
const logger = (req, res, next) => {
  const mulai = Date.now();

  res.on("finish", () => {
    const durasi = Date.now() - mulai;
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${durasi}ms)`);
  });

  next();
};

module.exports = logger;
