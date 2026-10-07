/**
 * MODEL EXERCISE — UTS SOA
 * ========================
 *
 * Peta tabel `exercises` sesuai RANCANGAN.md §2 — master data gerakan
 * olahraga yang dikelola Admin.
 *
 * Ciri khas model ini (tuntutan butir 3 UTS):
 * - `validate` lengkap: kalori_per_menit harus positif, kategori dibatasi
 *   lewat isIn (versi ORM dari ENUM schema.sql, mengikuti pola `kategori`
 *   dan `tahun_terbit` di model Buku materi Minggu 4).
 * - Setter normalisasi `nama_latihan` + `unique` anti duplikat.
 */
const { Model } = require("sequelize");

// Satu daftar dipakai dua kali: validasi model dan pesan error.
// Kalau nanti kategori bertambah, cukup ubah di sini.
const KATEGORI = ["upper body", "lower body", "core", "cardio", "full body"];

module.exports = (sequelize, DataTypes) => {
  class Exercise extends Model {
    /**
     * Sisi "many" dari relasi N:M workout_logs <-> exercises.
     * Satu gerakan bisa muncul di BANYAK log latihan (via pivot).
     *
     * `as: "workout_logs"` = key JSON saat di-include; sama persis dengan
     * yang dipakai controller dan koleksi Postman (butir 3 UTS).
     */
    static associate(models) {
      Exercise.belongsToMany(models.WorkoutLog, {
        through: models.WorkoutDetail,
        foreignKey: "exercise_id",
        otherKey: "workout_log_id",
        as: "workout_logs",
      });
    }
  }

  Exercise.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      nama_latihan: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true, // aturan bisnis 409: nama latihan tidak boleh kembar

        set(value) {
          this.setDataValue(
            "nama_latihan",
            String(value).trim().replace(/\s+/g, " ")
          );
        },

        validate: {
          notEmpty: { msg: "Field nama_latihan tidak boleh kosong" },
          len: {
            args: [3, 100],
            msg: "Field nama_latihan harus antara 3 sampai 100 karakter",
          },
        },
      },

      kategori: {
        type: DataTypes.ENUM(...KATEGORI),
        allowNull: false,
        validate: {
          isIn: {
            args: [KATEGORI],
            msg: `Field kategori harus salah satu dari: ${KATEGORI.join(", ")}`,
          },
        },
      },

      kalori_per_menit: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        validate: {
          isNumeric: { msg: "Field kalori_per_menit harus berupa angka" },
          min: {
            args: [0.01],
            msg: "Field kalori_per_menit harus lebih besar dari 0",
          },
          max: {
            args: [50],
            msg: "Field kalori_per_menit tidak masuk akal (maksimal 50)",
          },
        },
      },

      is_premium_only: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false, // gerakan default bisa dipakai semua user
      },
    },
    {
      sequelize,
      modelName: "Exercise",
      tableName: "exercises",

      // Tabel exercises punya created_at & updated_at, TIDAK punya
      // deleted_at (lihat RANCANGAN.md §2) — jadi timestamps nyala,
      // paranoid mati.
      timestamps: true,
      paranoid: false,

      defaultScope: {
        attributes: { exclude: ["createdAt", "updatedAt"] },
      },
    }
  );

  return Exercise;
};
