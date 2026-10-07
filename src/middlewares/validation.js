/**
 * MIDDLEWARE VALIDASI (JOI) — UTS SOA
 * ===================================
 *
 * Ini LAPIS PERTAMA validasi (menghasilkan 400 + pesan per field),
 * persis seperti utils/validate.js Minggu 2-3 tapi kini pakai Joi.
 *
 * Dua aturan yang TIDAK boleh dilanggar (CONTEXT.md §2 & butir 4 UTS):
 *   1. `abortEarly: false`  -> SEMUA field yang salah dilaporkan sekaligus,
 *                              bukan berhenti di error pertama.
 *   2. `stripUnknown: true` -> field asing (mis. isAdmin) DIBUANG diam-diam.
 *
 * Hasil validasi yang bersih ditaruh di `req.validated`. Controller WAJIB
 * memakai `req.validated`, JANGAN `req.body` — inilah penangkal mass
 * assignment (lihat Catatan 2 di utils/validate.js Minggu 2).
 *
 * Semua pesan sengaja berbahasa Indonesia dan menyebut NAMA field-nya.
 */
const Joi = require("joi");

/* ================================================================== */
/* SKEMA USER                                                          */
/* ================================================================== */

// POST /api/v1/users — registrasi.
const userRegisterSchema = Joi.object({
  nama: Joi.string()
    .trim()
    .min(3)
    .max(100)
    .required()
    .messages({
      "any.required": "Field nama wajib diisi",
      "string.empty": "Field nama tidak boleh kosong",
      "string.min": "Field nama minimal 3 karakter",
      "string.max": "Field nama maksimal 100 karakter",
      "string.base": "Field nama harus berupa teks",
    }),

  email: Joi.string()
    .trim()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      "any.required": "Field email wajib diisi",
      "string.empty": "Field email tidak boleh kosong",
      "string.email": "Field email harus berupa alamat email yang valid",
      "string.base": "Field email harus berupa teks",
    }),

  password: Joi.string()
    .min(8)
    .max(72)
    .required()
    .messages({
      "any.required": "Field password wajib diisi",
      "string.empty": "Field password tidak boleh kosong",
      "string.min": "Field password minimal 8 karakter",
      "string.max": "Field password maksimal 72 karakter",
      "string.base": "Field password harus berupa teks",
    }),

  berat_badan: Joi.number()
    .min(20)
    .max(300)
    .optional()
    .messages({
      "number.base": "Field berat_badan harus berupa angka",
      "number.min": "Field berat_badan tidak masuk akal (minimal 20 kg)",
      "number.max": "Field berat_badan tidak masuk akal (maksimal 300 kg)",
    }),

  tinggi_badan: Joi.number()
    .min(50)
    .max(250)
    .optional()
    .messages({
      "number.base": "Field tinggi_badan harus berupa angka",
      "number.min": "Field tinggi_badan tidak masuk akal (minimal 50 cm)",
      "number.max": "Field tinggi_badan tidak masuk akal (maksimal 250 cm)",
    }),

  // is_premium SENGAJA tidak ada di sini: registrasi tidak boleh memilih
  // statusnya sendiri. `stripUnknown:true` membuang field ini kalau klien
  // nyobanya, dan controller memaksa false. Upgrade hanya via Update User.
});

// PUT /api/v1/users/:id — update profil. Email & password TIDAK diubah
// lewat endpoint ini (jalur riêng / tidak di sini).
const userUpdateSchema = Joi.object({
  nama: Joi.string()
    .trim()
    .min(3)
    .max(100)
    .optional()
    .messages({
      "string.empty": "Field nama tidak boleh kosong",
      "string.min": "Field nama minimal 3 karakter",
      "string.max": "Field nama maksimal 100 karakter",
      "string.base": "Field nama harus berupa teks",
    }),

  berat_badan: Joi.number()
    .min(20)
    .max(300)
    .optional()
    .allow(null)
    .messages({
      "number.base": "Field berat_badan harus berupa angka",
      "number.min": "Field berat_badan tidak masuk akal (minimal 20 kg)",
      "number.max": "Field berat_badan tidak masuk akal (maksimal 300 kg)",
    }),

  tinggi_badan: Joi.number()
    .min(50)
    .max(250)
    .optional()
    .allow(null)
    .messages({
      "number.base": "Field tinggi_badan harus berupa angka",
      "number.min": "Field tinggi_badan tidak masuk akal (minimal 50 cm)",
      "number.max": "Field tinggi_badan tidak masuk akal (maksimal 250 cm)",
    }),

  is_premium: Joi.boolean().optional().messages({
    "boolean.base": "Field is_premium harus berupa true/false",
  }),
});

/* ================================================================== */
/* SKEMA EXERCISE                                                      */
/* ================================================================== */

// Satu daftar kategori — sumber kebenaran tunggal, dipakai pesan error juga.
const KATEGORI = ["upper body", "lower body", "core", "cardio", "full body"];

// Aturan per field ditulis SEKALI, dipakai ulang oleh schema create & update.
// Joi schema itu immutable, jadi menambah .required()/.optional() di tiap
// objek tidak saling memengaruhi.
const aturNamaLatihan = Joi.string()
  .trim()
  .min(3)
  .max(100)
  .messages({
    "string.empty": "Field nama_latihan tidak boleh kosong",
    "string.min": "Field nama_latihan minimal 3 karakter",
    "string.max": "Field nama_latihan maksimal 100 karakter",
    "string.base": "Field nama_latihan harus berupa teks",
    "any.required": "Field nama_latihan wajib diisi",
  });

const aturKategori = Joi.string()
  .trim()
  .valid(...KATEGORI)
  .messages({
    "any.only": `Field kategori harus salah satu dari: ${KATEGORI.join(", ")}`,
    "string.base": "Field kategori harus berupa teks",
    "any.required": "Field kategori wajib diisi",
  });

const aturKalori = Joi.number()
  .positive()
  .max(50)
  .messages({
    "number.base": "Field kalori_per_menit harus berupa angka",
    "number.positive": "Field kalori_per_menit harus lebih besar dari 0",
    "number.max": "Field kalori_per_menit tidak masuk akal (maksimal 50)",
    "any.required": "Field kalori_per_menit wajib diisi",
  });

const aturPremiumOnly = Joi.boolean().messages({
  "boolean.base": "Field is_premium_only harus berupa true/false",
});

// POST /api/v1/exercises — semua field wajib; is_premium_only default false.
const exerciseCreateSchema = Joi.object({
  nama_latihan: aturNamaLatihan.required(),
  kategori: aturKategori.required(),
  kalori_per_menit: aturKalori.required(),
  is_premium_only: aturPremiumOnly.optional().default(false),
});

// PATCH /api/v1/exercises/:id — semua field opsional, TANPA default.
// Sengaja dibangun ulang (bukan .fork dari create): default create
// (is_premium_only:false) TIDAK boleh ikut menyelinap ke PATCH, kalau tidak
// field yang tidak dikirim akan diam-diam ditimpa menjadi false.
const exerciseUpdateSchema = Joi.object({
  nama_latihan: aturNamaLatihan.optional(),
  kategori: aturKategori.optional(),
  kalori_per_menit: aturKalori.optional(),
  is_premium_only: aturPremiumOnly.optional(),
});

/* ================================================================== */
/* SKEMA WORKOUT LOG                                                   */
/* ================================================================== */

const workoutLogDetailSchema = Joi.object({
  exercise_id: Joi.number().integer().positive().required().messages({
    "any.required": "Field exercise_id pada details wajib diisi",
    "number.base": "Field exercise_id pada details harus berupa angka",
    "number.integer": "Field exercise_id pada details harus bilangan bulat",
    "number.positive": "Field exercise_id pada details harus lebih dari 0",
  }),

  // Kolom pivot `set` — namanya wajar bentrok dgn method Sequelize, tapi
  // untuk validasi masuk (body) tidak ada masalah.
  set: Joi.number().integer().min(1).max(20).optional().default(1).messages({
    "number.base": "Field set pada details harus berupa angka",
    "number.integer": "Field set pada details harus bilangan bulat",
    "number.min": "Field set pada details minimal 1",
    "number.max": "Field set pada details tidak masuk akal (maksimal 20)",
  }),

  repetition: Joi.number().integer().min(1).optional().allow(null).messages({
    "number.base": "Field repetition pada details harus berupa angka",
    "number.integer": "Field repetition pada details harus bilangan bulat",
    "number.min": "Field repetition pada details minimal 1",
  }),

  durasi_menit: Joi.number().integer().min(1).optional().allow(null).messages({
    "number.base": "Field durasi_menit pada details harus berupa angka",
    "number.integer": "Field durasi_menit pada details harus bilangan bulat",
    "number.min": "Field durasi_menit pada details minimal 1",
  }),
})
  // Aturan bisnis ringan: tiap gerakan harus punya repetisi ATAU durasi,
  // tidak boleh keduanya sekaligus, tidak boleh keduanya kosong.
  .nand("repetition", "durasi_menit")
  .or("repetition", "durasi_menit")
  .messages({
    "object.nand":
      "Field repetition dan durasi_menit pada details tidak boleh diisi bersamaan",
    "object.missing":
      "Field repetition atau durasi_menit pada details wajib diisi salah satu",
  });

const workoutLogCreateSchema = Joi.object({
  user_id: Joi.number().integer().positive().required().messages({
    "any.required": "Field user_id wajib diisi",
    "number.base": "Field user_id harus berupa angka",
    "number.integer": "Field user_id harus bilangan bulat",
    "number.positive": "Field user_id harus lebih dari 0",
  }),

  tanggal: Joi.string().isoDate().required().messages({
    "any.required": "Field tanggal wajib diisi",
    "string.isoDate": "Field tanggal harus berupa tanggal ISO (YYYY-MM-DD)",
    "string.base": "Field tanggal harus berupa teks",
  }),

  catatan: Joi.string().trim().max(500).optional().allow("", null).messages({
    "string.max": "Field catatan maksimal 500 karakter",
    "string.base": "Field catatan harus berupa teks",
  }),

  details: Joi.array().items(workoutLogDetailSchema).min(1).required().messages({
    "any.required": "Field details wajib diisi",
    "array.base": "Field details harus berupa array",
    "array.min": "Field details minimal berisi 1 gerakan",
  }),
});

/* ================================================================== */
/* SKEMA REKOMENDASI (integrasi Gemini)                                */
/* ================================================================== */

// POST /api/v1/recommendations/generate
const recommendationSchema = Joi.object({
  user_id: Joi.number().integer().positive().required().messages({
    "any.required": "Field user_id wajib diisi",
    "number.base": "Field user_id harus berupa angka",
    "number.integer": "Field user_id harus bilangan bulat",
    "number.positive": "Field user_id harus lebih dari 0",
  }),

  kondisi: Joi.string()
    .trim()
    .min(5)
    .max(500)
    .required()
    .messages({
      "any.required": "Field kondisi wajib diisi (ceritakan kondisi harianmu)",
      "string.empty": "Field kondisi tidak boleh kosong",
      "string.min": "Field kondisi minimal 5 karakter agar cukup jelas",
      "string.max": "Field kondisi maksimal 500 karakter",
      "string.base": "Field kondisi harus berupa teks",
    }),

  kategori: Joi.string().trim().valid(...KATEGORI).optional().messages({
    "any.only": `Field kategori harus salah satu dari: ${KATEGORI.join(", ")}`,
    "string.base": "Field kategori harus berupa teks",
  }),

  durasi_menit: Joi.number().integer().min(5).max(120).optional().messages({
    "number.base": "Field durasi_menit harus berupa angka",
    "number.integer": "Field durasi_menit harus bilangan bulat",
    "number.min": "Field durasi_menit minimal 5 menit",
    "number.max": "Field durasi_menit maksimal 120 menit",
  }),

  peralatan: Joi.string().trim().max(120).optional().messages({
    "string.max": "Field peralatan maksimal 120 karakter",
    "string.base": "Field peralatan harus berupa teks",
  }),
});

/* ================================================================== */
/* FACTORY MIDDLEWARE                                                  */
/* ================================================================== */

/**
 * Bikin middleware yang memvalidasi satu sumber request (default body).
 * @param {Joi.Schema} schema
 * @param {'body'|'query'|'params'} source
 * @returns middleware (req, res, next)
 */
const validate = (schema, source = "body") => (req, res, next) => {
  const { error, value } = schema.validate(req[source], {
    abortEarly: false, // kumpulkan SEMUA error, jangan berhenti di yang pertama
    stripUnknown: true, // field asing dibuang -> anti mass assignment
  });

  if (error) {
    // Rapikan details menjadi { namaField: [pesan, ...] }.
    const errors = {};
    for (const detail of error.details) {
      const field = detail.path.join(".") || source;
      if (!errors[field]) errors[field] = [];
      errors[field].push(detail.message);
    }
    return res
      .status(400)
      .json({ status: "fail", message: "Validasi gagal", errors });
  }

  // value = objek BERSIH (hanya field yang lolos, sudah dikonversi & default).
  // Controller membaca dari sini, BUKAN dari req.body.
  req.validated = value;
  return next();
};

module.exports = {
  validate,
  KATEGORI,
  schemas: {
    userRegisterSchema,
    userUpdateSchema,
    exerciseCreateSchema,
    exerciseUpdateSchema,
    workoutLogCreateSchema,
    recommendationSchema,
  },
};
