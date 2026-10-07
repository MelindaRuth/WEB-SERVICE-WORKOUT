/**
 * MODEL WORKOUTLOG — UTS SOA
 * ==========================
 *
 * Peta tabel `workout_logs` sesuai RANCANGAN.md §2 — satu baris =
 * satu sesi latihan harian seorang user.
 *
 * Ciri khas model ini (tuntutan butir 3 UTS):
 * - `DataTypes.VIRTUAL` `jumlah_gerakan`: dihitung saat dibaca dari
 *   relasi yang sudah di-eager-load, TIDAK ada kolomnya di database,
 *   dan setter-nya MENOLAK pengisian (anti mass-assignment — sama seperti
 *   pola `keterangan` di model Buku materi Minggu 4).
 * - `total_kalori` dihitung SERVICE (durasi x kalori_per_menit per
 *   rincian), bukan dipercaya dari request klien.
 */
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class WorkoutLog extends Model {
    /**
     * Dua relasi sekaligus:
     *
     * 1) Sisi cermin User.hasMany — satu log MILIK satu user:
     *        WorkoutLog.belongsTo(User, { as: "user" })
     *
     * 2) N:M dengan Exercise lewat pivot WorkoutDetail:
     *        WorkoutLog.belongsToMany(Exercise, { through: WorkoutDetail })
     *
     * `as` menentukan nama key JSON saat include — WAJIB sama dengan yang
     * dipakai controller & Postman: log.user, log.exercises,
     * dan log.exercises[i].WorkoutDetail untuk kolom pivot.
     */
    static associate(models) {
      WorkoutLog.belongsTo(models.User, {
        foreignKey: "user_id",
        as: "user",
      });

      WorkoutLog.belongsToMany(models.Exercise, {
        through: models.WorkoutDetail,
        foreignKey: "workout_log_id",
        otherKey: "exercise_id",
        as: "exercises",
      });
    }
  }

  WorkoutLog.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        // Aturan yang sama juga ada sebagai NOT NULL + FOREIGN KEY di
        // database — model menyatakan ulang agar ORM bisa memakainya
        // (log TANPA user tidak boleh ada).
      },

      tanggal: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          isDate: { msg: "Field tanggal harus berupa tanggal yang valid (YYYY-MM-DD)" },
        },
      },

      total_kalori: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: {
            args: [0],
            msg: "Field total_kalori tidak boleh negatif",
          },
        },
      },

      catatan: {
        type: DataTypes.TEXT,
        allowNull: true, // opini pengguna atas latihan — opsional
        set(value) {
          if (value == null) return this.setDataValue("catatan", null);
          this.setDataValue("catatan", String(value).trim());
        },
      },

      /* ------------------------------------------------------------
       * VIRTUAL FIELD — jumlah gerakan dalam satu sesi latihan.
       * ------------------------------------------------------------
       * Nilainya diambil dari relasi `exercises` HANYA kalau sudah
       * di-eager-load (include). Kalau belum, null — bukan memicu
       * query tersembunyi (itu justru N+1 yang lagi kita hindari).
       */
      jumlah_gerakan: {
        type: DataTypes.VIRTUAL,
        get() {
          const exercises = this.exercises;
          return Array.isArray(exercises) ? exercises.length : null;
        },
        set() {
          throw new Error(
            "Field jumlah_gerakan dihitung otomatis, tidak bisa diisi dari luar"
          );
        },
      },
    },
    {
      sequelize,
      modelName: "WorkoutLog",
      tableName: "workout_logs",

      timestamps: true,
      paranoid: false, // log latihan dihapus permanen kalau user menghapusnya
      // (user-nya yang paranoid, bukan log-nya — lihat RANCANGAN.md §2)

      defaultScope: {
        attributes: { exclude: ["createdAt", "updatedAt"] },
      },
    }
  );

  return WorkoutLog;
};
