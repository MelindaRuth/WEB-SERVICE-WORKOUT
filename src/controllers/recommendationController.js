/**
 * CONTROLLER RECOMMENDATION — UTS SOA (integrasi 3rd party API)
 * =============================================================
 *
 * POST /api/v1/recommendations/generate
 *
 * Logika freemium (inti nilai service ini — lihat RANCANGAN §1 & §5):
 *   - User FREE    -> ambil template latihan standar dari DATABASE internal.
 *   - User PREMIUM -> teruskan "kondisi" ke GEMINI API, lalu GABUNGKAN hasil
 *                     AI dengan katalog exercise lokal dalam satu response.
 *
 * Aturan integrasi yang TIDAK boleh dilanggar (butir 5 UTS):
 *   - panggilan keluar pakai axios, key HANYA dari .env.
 *   - response upstream TIDAK diteruskan apa adanya — field dipilih & diganti
 *     namanya agar konsisten dengan skema service kita.
 *   - upstream gagal (timeout / non-2xx / network) -> service tetap menjawab
 *     dengan status benar (504 / 502) + FALLBACK template dari DB. Tidak crash,
 *     tidak menggantung.
 */
const axios = require("axios");
const { Op } = require("sequelize");
const { User, Exercise } = require("../models");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 8000;

const EQUIPMENT_ALIASES = new Map([
  ["bodyweight", "bodyweight"],
  ["body weight", "bodyweight"],
  ["bw", "bodyweight"],
  ["matras", "matras"],
  ["yoga mat", "bodyweight"],
  ["dumbbell", "dumbbell"],
  ["barbell", "barbell"],
  ["treadmill", "treadmill"],
  ["resistance band", "resistance_band"],
  ["resistance_band", "resistance_band"],
  ["kettlebell", "kettlebell"],
  ["rings", "rings"],
  ["ring", "rings"],
  ["mesin lat pulldown", "lat_pulldown"],
  ["lat pulldown", "lat_pulldown"],
  ["lat_pulldown", "lat_pulldown"],
  ["leg curl/extension", "leg_curl_extension"],
  ["leg curl extension", "leg_curl_extension"],
  ["leg_curl_extension", "leg_curl_extension"],
]);

const parseEquipment = (input) => {
  const values = String(input || "")
    .split(",")
    .map((value) => value.trim().toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean);
  const canonical = [...new Set(values.map((value) => EQUIPMENT_ALIASES.get(value)).filter(Boolean))];
  return { canonical, unknown: values.filter((value) => !EQUIPMENT_ALIASES.has(value)) };
};

/* ------------------------------------------------------------------ */
/* Ambil template gerakan dari DB lokal (dipakai Free & sebagai        */
/* fallback saat Gemini gagal). Kolom dinormalisasi ke skema service.  */
/* ------------------------------------------------------------------ */
const ambilTemplateDariDB = async ({ premium, kategori, durasiMenit, equipment }) => {
  const kondisi = premium ? {} : { is_premium_only: false };
  if (kategori) kondisi.kategori = kategori;
  if (equipment?.length) kondisi.equipment = { [Op.in]: equipment };

  // Perkiraan jumlah gerakan: ~1 gerakan / 3 menit, batas 4..10.
  const jumlah = Math.min(Math.max(Math.floor((durasiMenit || 15) / 3), 4), 10);

  const rows = await Exercise.findAll({
    where: kondisi,
    attributes: ["id", "nama_latihan", "kategori", "equipment", "kalori_per_menit", "is_premium_only"],
    order: [["nama_latihan", "ASC"]],
    limit: jumlah,
  });

  // Bangun ulang objek — field dipilih & diberi nama yang stabil (bukan
  // instance Sequelize apa adanya), supaya kontrak response tidak berubah
  // kalau kolom tabel berubah.
  return rows.map((e) => ({
    exercise_id: e.id,
    gerakan: e.nama_latihan,
    kelompok_otot: e.kategori,
    equipment: e.equipment,
    estimasi_kalori_per_menit: Number(e.kalori_per_menit),
  }));
};

const buatRencanaHarian = (gerakan, jumlahHari) => {
  if (!jumlahHari) return undefined;
  const kelompok = ["upper body", "lower body", "core", "cardio", "full body"];
  return Array.from({ length: jumlahHari }, (_, index) => {
    const fokus = kelompok[index % kelompok.length];
    const pilihan = gerakan.filter((item) => item.kelompok_otot === fokus);
    return {
      hari: index + 1,
      fokus,
      gerakan: (pilihan.length ? pilihan : gerakan).slice(0, 4),
    };
  });
};

/* ------------------------------------------------------------------ */
/* Panggil Gemini. Mengembalikan TEKS murni; error diteruskan naik.     */
/* ------------------------------------------------------------------ */
const panggilGemini = async (prompt) => {
  const { data } = await axios.post(
    GEMINI_URL,
    { contents: [{ role: "user", parts: [{ text: prompt }] }] },
    {
      // key lewat HEADER, bukan query string -> tidak tercecer di log URL.
      headers: { "x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json" },
      timeout: GEMINI_TIMEOUT_MS,
    }
  );

  // AMBIL HANYA yang kita perlu dari payload upstream yang besar & ubah
  // namanya. Format asli { candidates: [...] } TIDAK diteruskan ke klien.
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const teks = parts.map((p) => p.text ?? "").join("").trim();
  return teks;
};

/* ================================================================== */
/* POST /api/v1/recommendations/generate                               */
/* ================================================================== */
const generateRecommendation = async (req, res) => {
  const { user_id, kondisi, kategori, durasi_menit, peralatan, jumlah_hari } = req.validated;

  const user = await User.findByPk(user_id);
  if (!user) {
    return res
      .status(404)
      .json({ status: "fail", message: `User dengan id ${user_id} tidak ditemukan` });
  }

  // ---------------- FREE: template statis dari DB, tidak sentuh Gemini ----
  if (!user.is_premium) {
    const gerakan = await ambilTemplateDariDB({ premium: false, kategori, durasiMenit: durasi_menit });
    return res.status(200).json({
      status: "success",
      data: {
        tipe_akun: "free",
        sumber: "template_database",
        pesan: "Rekomendasi template standar. Upgrade ke Premium untuk program kustom dari AI.",
        arahan_ai: null,
        gerakan,
      },
    });
  }

  const equipmentInput = parseEquipment(peralatan);
  if (peralatan && equipmentInput.unknown.length) {
    return res.status(400).json({
      status: "fail",
      message: `Peralatan tidak dikenali: ${equipmentInput.unknown.join(", ")}. Gunakan nama alat yang valid atau pisahkan dengan koma.`,
    });
  }
  if (peralatan && !equipmentInput.canonical.length) {
    return res.status(400).json({
      status: "fail",
      message: "Field peralatan harus berisi minimal satu alat yang dikenali.",
    });
  }

  const equipmentFilter = equipmentInput.canonical.length
    ? [...new Set(equipmentInput.canonical.flatMap((equipment) => equipment === "matras" ? ["matras", "bodyweight"] : [equipment]))]
    : undefined;
  // ---------------- PREMIUM: Gemini + gabungan data DB -------------------
  const prompt =
    `Kamu pelatih kebugaran. Buatkan rutinitas ${jumlah_hari ? `${jumlah_hari} hari` : "latihan"} yang aman dan realistis. ` +
    `Kondisi user: "${kondisi}". ` +
    (kategori ? `Fokus: ${kategori}. ` : "") +
    (durasi_menit ? `Durasi total ${durasi_menit} menit. ` : "") +
    (peralatan
      ? `HANYA gunakan peralatan berikut dan jangan menyarankan alat lain: ${peralatan}. `
      : "Gunakan peralatan umum yang tersedia. ") +
    `Berikan pembagian hari, latihan, set, dan repetisi.`;

  // Fallback selalu disiapkan lebih dulu supaya kegagalan sekecil apa pun
  // tidak membuat klien pulang tangan hampa.
  const fallbackGerakan = await ambilTemplateDariDB({
    premium: true,
    kategori,
    durasiMenit: durasi_menit,
    equipment: equipmentFilter,
  });
  const rencanaFallback = buatRencanaHarian(fallbackGerakan, jumlah_hari);

  try {
    if (!GEMINI_API_KEY) {
      // Config belum diisi -> dianggap upstream tak tersedia (bukan 500).
      const e = new Error("GEMINI_API_KEY belum dikonfigurasi");
      e.code = "NO_KEY";
      throw e;
    }

    const teksAI = await panggilGemini(prompt);

    // Gabungkan hasil AI dengan katalog lokal dalam SATU response.
    const gerakan = await ambilTemplateDariDB({
      premium: true,
      kategori,
      durasiMenit: durasi_menit,
      equipment: equipmentFilter,
    });
    return res.status(200).json({
      status: "success",
      data: {
        tipe_akun: "premium",
        sumber: "gemini_ai",
        arahan_ai: teksAI || "(AI tidak mengembalikan teks)",
        gerakan_katalog_lokal: gerakan,
        peralatan_dipilih: equipmentFilter || [],
        jumlah_hari: jumlah_hari || null,
        rencana_harian: buatRencanaHarian(gerakan, jumlah_hari),
      },
    });
  } catch (err) {
    // --- Petakan kegagalan upstream ke status code yang benar + fallback ---
    const adalahTimeout =
      err.code === "ECONNABORTED" || err.code === "ETIMEDOUT" || /timeout/i.test(err.message || "");

    let httpStatus, kode;
    if (adalahTimeout) {
      httpStatus = 504;
      kode = "UPSTREAM_TIMEOUT";
    } else if (err.response) {
      // Gemini membalas non-2xx (mis. 400 prompt ditolak, 429 quota).
      httpStatus = 502;
      kode = "UPSTREAM_ERROR";
    } else {
      // Network error / DNS / key belum diisi -> tak ada balasan sama sekali.
      httpStatus = 502;
      kode = "UPSTREAM_UNREACHABLE";
    }

    // Detail upstream (err.response.data dll.) HANYA ke log, tidak ke klien.
    console.error("[GEMINI] upstream gagal:", err.response?.status, err.response?.data || err.message);

    return res.status(httpStatus).json({
      status: "fail",
      message:
        kode === "UPSTREAM_TIMEOUT"
          ? "Layanan AI terlalu lama merespons, berikut rekomendasi penggantinya."
          : "Layanan AI sedang tidak dapat dihubungi, berikut rekomendasi penggantinya.",
      data: {
        tipe_akun: "premium",
        sumber: "fallback_database",
        upstream_error: kode,
        gerakan: fallbackGerakan,
        peralatan_dipilih: equipmentFilter || [],
        jumlah_hari: jumlah_hari || null,
        rencana_harian: rencanaFallback,
      },
    });
  }
};

module.exports = { generateRecommendation };
