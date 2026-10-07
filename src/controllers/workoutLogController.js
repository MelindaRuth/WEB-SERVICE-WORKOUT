/**
 * CONTROLLER WORKOUT LOG — UTS SOA
 * ================================
 *
 * Menyimpan satu SESI latihan seorang user beserta rincian gerakannya.
 * Di sinilah relasi N:M (workout_logs <-> exercises via pivot
 * workout_details) dipakai sungguhan, termasuk menampilkan KOLOM PIVOT
 * (set, repetition, durasi_menit, kalori_terbakar) lewat eager loading.
 *
 * Aturan penting:
 * - total_kalori & kalori_terbakar DITELITI & DIHITUNG oleh service,
 *   tidak pernah dipercaya dari request klien (butir 4: tak ada req.body
 *   yang langsung disimpan).
 * - baca atribut pivot `set` dari instance memakai detail.get("set")
 *   (nama `set` bentrok dengan method bawaan Sequelize — lihat model).
 */
const { Op } = require("sequelize");
const { sequelize, User, Exercise, WorkoutLog, WorkoutDetail } = require("../models");

// Asumsi durasi per repetisi untuk gerakan berbasis set (detik). Dipakai
// saat klien mengirim repetisi tanpa durasi_menit. Bisa disetel di .env.
const DETIK_PER_REP = Number(process.env.DETIK_PER_REP) || 3;

/**
 * Estimasi durasi efektif (menit) satu rincian.
 * - Kalau durasi_menit dikirim -> pakai apa adanya.
 * - Kalau tidak -> set x repetition x DETIK_PER_REP / 60.
 */
const estimasiDurasiMenit = (d) => {
  if (d.durasi_menit) return Number(d.durasi_menit);
  const set = d.set || 1;
  const rep = d.repetition || 0;
  return (set * rep * DETIK_PER_REP) / 60;
};

const round2 = (n) => Math.round(Number(n) * 100) / 100;

/**
 * Ambil satu log LENGKAP (induk user + exercises + kolom pivotnya).
 * SATU query dengan JOIN (bukan N+1) — inilah bukti yang diminta RANCANGAN §8.
 */
const getLogLengkap = async (id) =>
  WorkoutLog.findByPk(Number(id), {
    include: [
      { model: User, as: "user", attributes: ["id", "nama", "email", "is_premium"] },
      {
        model: Exercise,
        as: "exercises",
        // through.attributes = tampilkan KOLOM MILIK PIVOT (butir 3 UTS).
        through: { attributes: ["id", "set", "repetition", "durasi_menit", "kalori_terbakar"] },
        attributes: ["id", "nama_latihan", "kategori", "kalori_per_menit"],
      },
    ],
  });

/* ================================================================== */
/* POST /api/v1/workout-logs                                           */
/* ================================================================== */
const createWorkoutLog = async (req, res) => {
  const { user_id, tanggal, catatan, details } = req.validated;

  // 1) user harus ada.
  const user = await User.findByPk(user_id);
  if (!user) {
    return res
      .status(404)
      .json({ status: "fail", message: `User dengan id ${user_id} tidak ditemukan` });
  }

  // 2) semua exercise yang dirujuk harus ada; kumpulkan datanya sekali (anti N+1).
  const exerciseIds = details.map((d) => d.exercise_id);
  const exercises = await Exercise.findAll({ where: { id: { [Op.in]: exerciseIds } } });
  const petaExercise = new Map(exercises.map((e) => [e.id, e]));

  const tidakAda = exerciseIds.filter((id) => !petaExercise.has(id));
  if (tidakAda.length) {
    return res.status(404).json({
      status: "fail",
      message: `Exercise tidak ditemukan: ${tidakAda.join(", ")}`,
    });
  }

  // 3) aturan freemium: user Free tidak boleh mencatat exercise premium-only.
  if (!user.is_premium) {
    const premiumDipakai = exercises
      .filter((e) => e.is_premium_only)
      .map((e) => e.nama_latihan);
    if (premiumDipakai.length) {
      return res.status(409).json({
        status: "fail",
        message: `User Free tidak dapat mencatat latihan premium: ${premiumDipakai.join(", ")}`,
      });
    }
  }

  // 4) hitung kalori per rincian + total (logika service, bukan klien).
  const rincian = details.map((d) => {
    const ex = petaExercise.get(d.exercise_id);
    const menit = estimasiDurasiMenit(d);
    const kalori = round2(menit * Number(ex.kalori_per_menit));
    return { ...d, menit_efektif: menit, kalori_terbakar: kalori };
  });
  const totalKalori = round2(rincian.reduce((sum, r) => sum + r.kalori_terbakar, 0));

  // 5) simpan dalam SATU transaksi: log + semua pivot-nya all-or-nothing.
  const t = await sequelize.transaction();
  try {
    const log = await WorkoutLog.create(
      { user_id, tanggal, catatan, total_kalori: totalKalori },
      { transaction: t }
    );

    await WorkoutDetail.bulkCreate(
      rincian.map((r) => ({
        workout_log_id: log.id,
        exercise_id: r.exercise_id,
        set: r.set || 1,
        repetition: r.repetition ?? null,
        durasi_menit: r.durasi_menit ?? null,
        kalori_terbakar: r.kalori_terbakar,
      })),
      { transaction: t }
    );

    await t.commit();
    const lengkap = await getLogLengkap(log.id);

    return res
      .status(201)
      .location(`/api/v1/workout-logs/${log.id}`)
      .json({ status: "success", message: "Log latihan berhasil disimpan", data: lengkap });
  } catch (err) {
    await t.rollback();
    throw err; // ke errorHandler (400 validasi model / 500)
  }
};

/* ================================================================== */
/* GET /api/v1/workout-logs/:id                                        */
/* ================================================================== */
const getWorkoutLogById = async (req, res) => {
  const log = await getLogLengkap(req.params.id);
  if (!log) {
    return res
      .status(404)
      .json({ status: "fail", message: `Workout log dengan id ${req.params.id} tidak ditemukan` });
  }
  return res.status(200).json({ status: "success", data: log });
};

/* ================================================================== */
/* GET /api/v1/users/:id/workout-logs  (nested resource)               */
/* ================================================================== */
const listUserWorkoutLogs = async (req, res) => {
  const { id } = req.params;
  const { sort, order, limit, offset } = req.query;

  const user = await User.findByPk(id, { attributes: ["id", "nama"] });
  if (!user) {
    return res
      .status(404)
      .json({ status: "fail", message: `User dengan id ${id} tidak ditemukan` });
  }

  const KOLOM_SORT = ["id", "tanggal", "total_kalori", "createdAt"];
  const { count: total, rows } = await WorkoutLog.findAndCountAll({
    where: { user_id: user.id },
    attributes: ["id", "tanggal", "total_kalori", "catatan", "createdAt"],
    order: [[KOLOM_SORT.includes(sort) ? sort : "tanggal", order === "asc" ? "ASC" : "DESC"]],
    limit: Math.min(Number(limit) || 20, 100),
    offset: Number(offset) || 0,
  });

  return res.status(200).json({
    status: "success",
    user: user,
    total,
    limit: Number(limit) || 20,
    offset: Number(offset) || 0,
    data: rows,
  });
};

/* ================================================================== */
/* GET /api/v1/workout-logs/statistik                                  */
/* Query: ?user_id= &mulai=YYYY-MM-DD &sampai=YYYY-MM-DD               */
/*                                                                     */
/* VERSI RAW QUERY dari endpoint yang sama (butir 3 UTS: satu endpoint  */
/* ditulis dua kali). Agregasi multi-tabel + GROUP BY minggu jauh lebih */
/* ringkas & jelas plan-nya di SQL ketimbang findAll lalu reduce di JS. */
/* WAJIB pakai replacements (bukan tempel nilai ke string) — anti       */
/* SQL injection. Versi ORM-nya dipertahankan sebagai pembanding di     */
/* komentar bawah.                                                     */
/* ================================================================== */
const getStatistik = async (req, res) => {
  const { user_id, mulai, sampai } = req.query;

  if (!user_id) {
    return res
      .status(400)
      .json({ status: "fail", message: "Parameter query user_id wajib diisi" });
  }

  // Bangun filter tanggal secara dinamis TAPI tetap lewat replacements.
  const replacements = { userId: Number(user_id) };
  let filterWaktu = "";
  if (mulai) {
    filterWaktu += " AND wl.tanggal >= :mulai";
    replacements.mulai = mulai;
  }
  if (sampai) {
    filterWaktu += " AND wl.tanggal <= :sampai";
    replacements.sampai = sampai;
  }

  const sql = `
    SELECT
      COUNT(wl.id)                              AS total_sesi,
      COALESCE(SUM(wl.total_kalori), 0)         AS total_kalori,
      COALESCE(ROUND(AVG(wl.total_kalori), 2), 0) AS rata_kalori_per_sesi,
      COUNT(DISTINCT wd.exercise_id)            AS gerakan_divariasikan
    FROM workout_logs wl
    LEFT JOIN workout_details wd ON wd.workout_log_id = wl.id
    WHERE wl.user_id = :userId
      ${filterWaktu}
  `;

  const [ringkasan] = await sequelize.query(sql, {
    replacements,
    type: sequelize.Sequelize.QueryTypes.SELECT,
  });

  // Penjelasan ORM pembanding (TIDAK dipakai — disimpan untuk dokumentasi):
  //   const logs = await WorkoutLog.findAll({ where: { user_id, tanggal: {...} }});
  //   const totalSesi = logs.length;
  //   const totalKalori = logs.reduce((s, l) => s + Number(l.total_kalori), 0);
  // Versi ORM menarik SEMUA baris ke JS lalu menghitung di memori; versi raw
  // menghitung di database. Untuk agregasi, raw menang -> karena itu dipakai.

  return res.status(200).json({
    status: "success",
    user_id: Number(user_id),
    rentang: { mulai: mulai || null, sampai: sampai || null },
    data: {
      total_sesi: Number(ringkasan.total_sesi),
      total_kalori: Number(ringkasan.total_kalori),
      rata_kalori_per_sesi: Number(ringkasan.rata_kalori_per_sesi),
      gerakan_divariasikan: Number(ringkasan.gerakan_divariasikan),
    },
  });
};

module.exports = {
  createWorkoutLog,
  getWorkoutLogById,
  listUserWorkoutLogs,
  getStatistik,
};
