/**
 * CONTROLLER USER — UTS SOA
 * =========================
 *
 * Pola sama persis dengan controllers/buku.js Minggu 4: controller
 * berbicara langsung ke MODEL (ORM = lapisan data), TIDAK menulis SQL.
 *
 * Alur tiap aksi tulis: 404 -> (validasi sudah di middleware) -> aturan
 * bisnis (409) -> simpan. Response tidak pernah berubah bentuknya agar
 * koleksi Postman stabil.
 *
 * PENTING: objek yang masuk ke database SELALU `req.validated` (hasil
 * Joi), JANGAN `req.body` — penangkal mass assignment (butir 4 UTS).
 */
const { fn, col, where: rawWhere } = require("sequelize");
const bcrypt = require("bcryptjs");
const { User, WorkoutLog } = require("../models");

// Biaya hashing bcrypt. 10 adalah keseimbangan wajar aman-cepat untuk API.
const BCRYPT_ROUNDS = 10;

// Hash asli dari password tiruan. Dipakai saat email tidak dikenal supaya
// bcrypt tetap bekerja dan waktu respons tidak membocorkan akun mana yang ada.
const HASH_TANDINGAN = "$2b$10$ZI7bfwadsb8t7jh9PLr/q.EBSQM7Rb2tiqR3Lpf8rG6IsZJet6Iqm";

// Whitelist kolom sort. Nama kolom ORDER BY tidak bisa jadi bound value
// (di ORM maupun SQL mentah), jadi HARUS disaring — cegah injeksi.
const KOLOM_SORT_BOLEH = ["id", "username", "nama", "is_premium", "createdAt"];

/* ================================================================== */
/* POST /api/v1/users                                                  */
/* ================================================================== */
const registerUser = async (req, res) => {
  // Bangun ulang objek dari field yang lolos Joi — JANGAN req.body mentah.
  const {
    username: usernameInput,
    nama,
    email,
    password,
    umur,
    gender,
    berat_badan,
    tinggi_badan,
  } = req.validated;

  // Username boleh tidak dikirim saat registrasi -> turunkan dari prefix
  // email (mis. "sari@test.com" -> "sari"). Model menormalisasi ke lowercase.
  const username = (usernameInput || email.split("@")[0] || nama).toLowerCase();

  // Aturan bisnis: email tidak boleh kembar (lapis pertama; UNIQUE KEY &
  // validasi model jadi jaring kedua & ketiga). DICEK PALING AWAL supaya
  // pesan konflik tetap sama seperti kontrak API lama.
  const kembar = await User.findOne({
    where: rawWhere(fn("LOWER", col("email")), email.toLowerCase()),
  });
  if (kembar) {
    return res
      .status(409)
      .json({ status: "fail", message: `Email ${email} sudah terdaftar` });
  }

  // Aturan bisnis 409: username tidak boleh kembar.
  const usernameKembar = await User.findOne({
    where: rawWhere(fn("LOWER", col("username")), username),
  });
  if (usernameKembar) {
    return res
      .status(409)
      .json({ status: "fail", message: `Username ${username} sudah dipakai` });
  }

  // Password di-HASH sebelum disentuh database (butir 4: lindungi kredensial).
  // Model TIDAK tahu mekanisme hashing — ini tanggung jawab controller.
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Registrasi biasa SELALU mulai sebagai user Free. Field is_premium dari
  // body DIABAIKAN; upgrade premium hanya lewat jalur Update User (Admin/bayar).
  const userBaru = await User.create({
    username,
    nama,
    email,
    password: passwordHash,
    umur,
    gender,
    berat_badan,
    tinggi_badan,
    is_premium: false,
  });

  // defaultScope menyembunyikan password HANYA pada hasil finder (findByPk/
  // findAll), BUKAN pada instance hasil create() yang masih membawa field yang
  // baru saja di-assign. Jadi buang password secara eksplisit dari payload.
  const { password: _buang, ...tanpaPassword } = userBaru.get({ plain: true });

  return res
    .status(201)
    .location(`/api/v1/users/${userBaru.id}`)
    .json({ status: "success", message: "User berhasil didaftarkan", data: tanpaPassword });
};

/* ================================================================== */
/* POST /api/v1/users/login                                            */
/* ================================================================== */
const loginUser = async (req, res) => {
  const { email, password } = req.validated;

  // defaultScope menyembunyikan `password`, jadi hash diminta lewat scope
  // khusus `withPassword`. Hash tidak pernah ikut ke dalam response.
  const user = await User.scope("withPassword").findOne({
    where: rawWhere(fn("LOWER", col("email")), email.toLowerCase()),
  });

  // Satu pesan untuk email tak dikenal DAN password salah: respons tidak boleh
  // membocorkan akun mana yang terdaftar.
  const passwordCocok = await bcrypt.compare(password, user ? user.password : HASH_TANDINGAN);
  if (!user || !passwordCocok) {
    return res
      .status(401)
      .json({ status: "fail", message: "Email atau password salah" });
  }

  const { password: _buang, ...tanpaPassword } = user.get({ plain: true });

  return res.status(200).json({
    status: "success",
    message: `Login berhasil, selamat datang ${user.username || user.nama}`,
    data: tanpaPassword,
  });
};

/* ================================================================== */
/* GET /api/v1/users                                                   */
/* Query: ?is_premium= &sort= &order= &limit= &offset=                 */
/* ================================================================== */
const getAllUsers = async (req, res) => {
  const { is_premium, sort, order, limit, offset } = req.query;

  // Filter memakai Op (BUKAN .filter() JavaScript setelah findAll).
  const kondisi = {};
  if (is_premium !== undefined) {
    // Query string datang sebagai string "true"/"false" -> konversi eksplisit.
    kondisi.is_premium = is_premium === "true" || is_premium === "1";
  }

  const { count: total, rows } = await User.findAndCountAll({
    where: Object.keys(kondisi).length ? kondisi : undefined,
    attributes: [
      "id",
      "username",
      "nama",
      "email",
      "is_premium",
      "umur",
      "gender",
      "berat_badan",
      "tinggi_badan",
      "createdAt",
    ],
    order: [
      [KOLOM_SORT_BOLEH.includes(sort) ? sort : "id", order === "desc" ? "DESC" : "ASC"],
    ],
    limit: Math.min(Number(limit) || 20, 100), // default 20, kunci maksimal
    offset: Number(offset) || 0,
  });

  return res.status(200).json({
    status: "success",
    total,
    limit: Number(limit) || 20,
    offset: Number(offset) || 0,
    data: rows,
  });
};

/* ================================================================== */
/* GET /api/v1/users/:id                                               */
/* ================================================================== */
const getUserById = async (req, res) => {
  // paranoid:true otomatis mengecualikan baris yang sudah soft-deleted,
  // jadi user terhapus tetap menghasilkan 404 di sini.
  const user = await User.findByPk(req.params.id, {
    include: {
      model: WorkoutLog,
      as: "workout_logs", // alias = key JSON, konsisten dengan models/User.js
      attributes: ["id", "tanggal", "total_kalori"],
    },
  });

  if (!user) {
    return res
      .status(404)
      .json({ status: "fail", message: `User dengan id ${req.params.id} tidak ditemukan` });
  }

  return res.status(200).json({ status: "success", data: user });
};

/* ================================================================== */
/* PUT /api/v1/users/:id                                               */
/* ================================================================== */
const updateUser = async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) {
    return res
      .status(404)
      .json({ status: "fail", message: `User dengan id ${req.params.id} tidak ditemukan` });
  }

  // user.update() mengubah HANYA field di req.validated, menjalankan
  // validasi model, lalu UPDATE ... WHERE id = ?.
  // CATATAN: is_premium di sini adalah JALUR SAH upgrade (dipanggil hanya
  // oleh Admin/sistem pembayaran). Setelah JWT aktif (rancangan butir 4),
  // endpoint ini dibatasi peran admin — bukan user mengubah dirinya sendiri.
  await user.update(req.validated);

  const terbaru = await User.findByPk(req.params.id);
  return res
    .status(200)
    .json({ status: "success", message: "Data user berhasil diperbarui", data: terbaru });
};

/* ================================================================== */
/* DELETE /api/v1/users/:id  (soft delete / paranoid)                  */
/* ================================================================== */
const deleteUser = async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) {
    return res
      .status(404)
      .json({ status: "fail", message: `User dengan id ${req.params.id} tidak ditemukan` });
  }

  // Aturan bisnis 409: user yang masih punya workout log AKTIF tidak boleh
  // dihapus (riwayat latihan pengguna aktif tidak boleh hilang begitu saja).
  const jumlahLog = await WorkoutLog.count({ where: { user_id: user.id } });
  if (jumlahLog > 0) {
    return res.status(409).json({
      status: "fail",
      message: `User masih memiliki ${jumlahLog} workout log aktif dan tidak dapat dihapus`,
    });
  }

  // paranoid:true -> destroy() hanya mengisi deleted_at, baris tetap ada.
  await user.destroy();

  return res
    .status(200)
    .json({ status: "success", message: `User "${user.nama}" berhasil dihapus (soft delete)` });
};

module.exports = {
  registerUser,
  loginUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
};
