/**
 * MODEL USER — UTS SOA
 * ====================
 *
 * Peta tabel `users` sesuai RANCANGAN.md §2.
 *
 * Ciri khas model ini (tuntutan butir 3 UTS):
 * - `paranoid: true`  → soft delete. DELETE tidak membuang baris, hanya
 *   mengisi kolom `deleted_at`; seluruh query otomatis menyaring
 *   `deleted_at IS NULL`.
 * - `validate` pada email & metrik tubuh (jaring kedua setelah Joi).
 * - Setter pada `nama` untuk normalisasi spasi — tidak ada jalur INSERT
 *   yang bisa lolos, sama seperti pola `judul` di model Buku materi Minggu 4.
 */
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Relasi dinyatakan di sini, tapi DIPANGGIL dari models/index.js
     * setelah semua model dibangun (kenapa? baca catatan di models/index.js).
     *
     * Satu user punya BANYAK workout log:
     *     User.hasMany(WorkoutLog, { foreignKey: "user_id", as: "workout_logs" })
     *
     * `as` WAJIB sama dengan key JSON yang dikembalikan controller dan
     * sama dengan nama yang dipakai di `include` — konsisten dari model
     * sampai response (butir 3 UTS).
     */
    static associate(models) {
      User.hasMany(models.WorkoutLog, {
        foreignKey: "user_id",
        as: "workout_logs",
      });
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      nama: {
        type: DataTypes.STRING(100),
        allowNull: false,
        set(value) {
          this.setDataValue("nama", String(value).trim().replace(/\s+/g, " "));
        },
        validate: {
          notEmpty: { msg: "Field nama tidak boleh kosong" },
          len: {
            args: [3, 100],
            msg: "Field nama harus antara 3 sampai 100 karakter",
          },
        },
      },

      email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true, // lapis ketiga setelah cek controller & UNIQUE KEY DB
        set(value) {
          // Email dinormalisasi ke huruf kecil agar "Budi@X.com" dan
          // "budi@x.com" tidak dianggap dua akun berbeda.
          this.setDataValue("email", String(value).trim().toLowerCase());
        },
        validate: {
          isEmail: { msg: "Field email harus berupa alamat email yang valid" },
        },
      },

      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
        // Catatan: hashing bcrypt dilakukan di CONTROLLER sebelum nilai
        // ini di-assign — model tidak boleh tahu mekanisme hashing.
        validate: {
          len: {
            args: [8, 255],
            msg: "Field password harus minimal 8 karakter",
          },
        },
      },

      is_premium: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false, // registrasi baru selalu mulai sebagai user Free
      },

      berat_badan: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true, // metrik tubuh boleh belum diisi saat registrasi
        validate: {
          min: {
            args: [20],
            msg: "Field berat_badan tidak masuk akal (minimal 20 kg)",
          },
          max: {
            args: [300],
            msg: "Field berat_badan tidak masuk akal (maksimal 300 kg)",
          },
        },
      },

      tinggi_badan: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        validate: {
          min: {
            args: [50],
            msg: "Field tinggi_badan tidak masuk akal (minimal 50 cm)",
          },
          max: {
            args: [250],
            msg: "Field tinggi_badan tidak masuk akal (maksimal 250 cm)",
          },
        },
      },
    },
    {
      sequelize,
      modelName: "User",
      tableName: "users",

      // SOFT DELETE — kolom deleted_at terisi saat DELETE, barisnya tetap ada.
      timestamps: true,
      paranoid: true,

      // DEFAULT SCOPE — password TIDAK PERNAH ikut terbawa ke response,
      // meski controller lupa mengirim `attributes`. Same idea as the
      // `keterangan`-exclusion scope in model Buku (Minggu 4): atur di
      // SATU tempat, bukan ingat-ingat per endpoint.
      defaultScope: {
        attributes: { exclude: ["password", "deletedAt"] },
      },

      // Scope khusus untuk login: butuh password untuk dibandingkan dengan bcrypt.
      // Dibentuk sebagai DAFTAR eksplisit — pola resmi Sequelize untuk
      // "mengembalikan" kolom yang dikecualikan defaultScope.
      // Dipakai eksplisit: User.scope("withPassword").findOne(...)
      scopes: {
        withPassword: {
          attributes: [
            "id",
            "nama",
            "email",
            "password",
            "is_premium",
            "berat_badan",
            "tinggi_badan",
            "createdAt",
            "updatedAt",
          ],
        },
      },
    }
  );

  return User;
};
