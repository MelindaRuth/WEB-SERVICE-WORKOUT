/**
 * CONTROLLER EXERCISE — UTS SOA
 * =============================
 *
 * Master data gerakan olahraga. Filter & pencarian WAJIB pakai Op
 * Sequelize di level query — BUKAN menyaring JavaScript setelah findAll()
 * (butir 3 UTS).
 *
 * Aksi tulis: 404 -> aturan bisnis (409) -> simpan. Data ke DB selalu
 * dari `req.validated`, tidak pernah `req.body` mentah.
 */
const { Op, fn, col, where: rawWhere } = require("sequelize");
const { Exercise, WorkoutDetail } = require("../models");

// Whitelist kolom sort (lihat alasan di userController).
const KOLOM_SORT_BOLEH = ["id", "nama_latihan", "kategori", "kalori_per_menit", "is_premium_only"];

/* ================================================================== */
/* GET /api/v1/exercises                                               */
/* Query: ?kategori= &keyword= &sort= &order= &limit= &offset=         */
/* ================================================================== */
const getAllExercises = async (req, res) => {
  const { kategori, keyword, sort, order, limit, offset } = req.query;

  // Bangun WHERE pakai Op — semua penyaringan terjadi di SQL, bukan JS.
  const kondisi = [];

  if (kategori) {
    kondisi.push({ kategori });
  }

  if (keyword) {
    const k = `%${keyword.toLowerCase()}%`;
    kondisi.push({
      [Op.and]: rawWhere(fn("LOWER", col("nama_latihan")), { [Op.like]: k }),
    });
  }

  const { count: total, rows } = await Exercise.findAndCountAll({
    where: kondisi.length ? { [Op.and]: kondisi } : undefined,
    order: [
      [
        KOLOM_SORT_BOLEH.includes(sort) ? sort : "id",
        order === "desc" ? "DESC" : "ASC",
      ],
    ],
    limit: Math.min(Number(limit) || 20, 100),
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
/* POST /api/v1/exercises                                              */
/* ================================================================== */
const createExercise = async (req, res) => {
  const data = req.validated;

  // Aturan bisnis 409 (lapis pertama): nama_latihan tidak boleh kembar.
  const kembar = await Exercise.findOne({
    where: rawWhere(fn("LOWER", col("nama_latihan")), data.nama_latihan.toLowerCase()),
  });
  if (kembar) {
    return res
      .status(409)
      .json({ status: "fail", message: `Latihan "${data.nama_latihan}" sudah terdaftar` });
  }

  const exerciseBaru = await Exercise.create(data);

  return res
    .status(201)
    .location(`/api/v1/exercises/${exerciseBaru.id}`)
    .json({
      status: "success",
      message: "Exercise berhasil ditambahkan",
      data: exerciseBaru,
    });
};

/* ================================================================== */
/* PATCH /api/v1/exercises/:id                                         */
/* ================================================================== */
const updateExercise = async (req, res) => {
  const exercise = await Exercise.findByPk(req.params.id);
  if (!exercise) {
    return res
      .status(404)
      .json({ status: "fail", message: `Exercise dengan id ${req.params.id} tidak ditemukan` });
  }

  // PATCH = ubah sebagian. Middleware sudah menegakkan tipe/rentang hanya
  // untuk field yang dikirim; di sini pastikan ada minimal satu perubahan.
  if (Object.keys(req.validated).length === 0) {
    return res
      .status(400)
      .json({ status: "fail", message: "Tidak ada field yang bisa diubah pada request ini" });
  }

  await exercise.update(req.validated);

  const terbaru = await Exercise.findByPk(req.params.id);
  return res
    .status(200)
    .json({ status: "success", message: "Exercise berhasil diperbarui", data: terbaru });
};

/* ================================================================== */
/* DELETE /api/v1/exercises/:id                                        */
/* ================================================================== */
const deleteExercise = async (req, res) => {
  const exercise = await Exercise.findByPk(req.params.id);
  if (!exercise) {
    return res
      .status(404)
      .json({ status: "fail", message: `Exercise dengan id ${req.params.id} tidak ditemukan` });
  }

  // Aturan bisnis 409: gerakan yang masih dirujuk workout_details (pernah
  // dicatat seseorang) tidak boleh dihapus — master data transaksi utuh.
  const jumlahRujukan = await WorkoutDetail.count({
    where: { exercise_id: exercise.id },
  });
  if (jumlahRujukan > 0) {
    return res.status(409).json({
      status: "fail",
      message: `Exercise masih dipakai pada ${jumlahRujukan} rincian latihan dan tidak dapat dihapus`,
    });
  }

  await exercise.destroy();

  return res
    .status(200)
    .json({ status: "success", message: `Exercise "${exercise.nama_latihan}" telah dihapus` });
};

module.exports = {
  getAllExercises,
  createExercise,
  updateExercise,
  deleteExercise,
};
