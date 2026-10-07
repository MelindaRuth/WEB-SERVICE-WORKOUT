/**
 * MODEL WORKOUTDETAIL (PIVOT) — UTS SOA
 * =====================================
 *
 * Peta tabel `workout_details` sesuai RANCANGAN.md §2 — TIDAK sekadar
 * tabel penghubung N:M. Ia punya kolom MILIK SENDIRI:
 *
 *     set, repetition, durasi_menit, kalori_terbakar
 *
 * yang merekam rincian eksekusi tiap gerakan dalam satu sesi latihan.
 * Inilah alasan relasinya memakai `belongsToMany({ through })` dan pivot-
 * nya ikut ditampilkan lewat `include` (butir 3 UTS).
 *
 * Karena pivot ini punya atribut sendiri, ia DIDEKLARASI sebagai model
 * penuh — bukan string "WorkoutDetail" — supaya `set` dsb. bisa dibaca
 * dan divalidasi oleh Sequelize.
 */
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class WorkoutDetail extends Model {
    /**
     * Sisi cermin belongsToMany — satu rincian MILIK satu log dan
     * MILIK satu gerakan. Alias `workout_log` / `exercise` dipakai
     * saat controller meng-include arah sebaliknya (detail -> induk).
     */
    static associate(models) {
      WorkoutDetail.belongsTo(models.WorkoutLog, {
        foreignKey: "workout_log_id",
        as: "workout_log",
      });
      WorkoutDetail.belongsTo(models.Exercise, {
        foreignKey: "exercise_id",
        as: "exercise",
      });
    }
  }

  WorkoutDetail.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      workout_log_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },

      exercise_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },

      set: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
        validate: {
          min: { args: [1], msg: "Field set harus minimal 1" },
          max: { args: [20], msg: "Field set tidak masuk akal (maksimal 20)" },
        },
      },

      repetition: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true, // kosong untuk gerakan berbasis durasi (plank, dsb.)
        validate: {
          min: {
            args: [1],
            msg: "Field repetition harus minimal 1 kalau diisi",
          },
        },
      },

      durasi_menit: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true, // kosong untuk gerakan berbasis repetisi
        validate: {
          min: {
            args: [1],
            msg: "Field durasi_menit harus minimal 1 kalau diisi",
          },
        },
      },

      kalori_terbakar: {
        // Kolom HASIL HITUNGAN service:
        //   durasi efektif (set x repetisi x estimasi, atau durasi_menit)
        //   x kalori_per_menit milik exercise, disesuaikan metrik user.
        // Nilai dari klien TIDAK PERNAH disimpan apa adanya.
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: {
            args: [0],
            msg: "Field kalori_terbakar tidak boleh negatif",
          },
        },
      },
    },
    {
      sequelize,
      modelName: "WorkoutDetail",
      tableName: "workout_details",

      // Tabel pivot ini TIDAK punya kolom created_at/updatedAt di schema
      // (lihat RANCANGAN.md §2) — matikan timestamps supaya Sequelize tidak
      // mencari kolom yang memang tidak ada, pola yang sama dengan model
      // Karakter di materi Minggu 4.
      timestamps: false,
    }
  );

  return WorkoutDetail;
};
