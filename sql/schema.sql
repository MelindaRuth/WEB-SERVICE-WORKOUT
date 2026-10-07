-- ============================================================================
--  SKEMA DATABASE — AI-Powered Workout & Habit Tracker (UTS SOA)
--  ============================================================================
--  Sumber kebenaran: src/models/*.js (Sequelize 6, dialect mysql, underscored).
--  Kolom VIRTUAL (jumlah_gerakan) TIDAK punya kolom fisik — jangan ditambahkan.
--  Nama tabel & kolom snake_case; created_at/updated_at/deleted_at dipetakan
--  otomatis oleh Sequelize (timestamps + paranoid pada model masing-masing).
--
--  Catatan paranoid:
--    users          -> paranoid TRUE  => punya deleted_at
--    exercises      -> paranoid FALSE => tidak ada deleted_at
--    workout_logs   -> paranoid FALSE => tidak ada deleted_at
--    workout_details-> timestamps FALSE => tidak ada created_at/updated_at
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `workout_tracker`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `workout_tracker`;

-- Buang tabel lama (urutan kebalikan dependensi FK) supaya skrip bisa diulang.
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `workout_details`;
DROP TABLE IF EXISTS `workout_logs`;
DROP TABLE IF EXISTS `exercises`;
DROP TABLE IF EXISTS `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- 1. users — akun pengguna (Free/Premium). Soft delete lewat deleted_at.
-- ----------------------------------------------------------------------------
CREATE TABLE `users` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `nama`          VARCHAR(100)  NOT NULL,
  `email`         VARCHAR(100)  NOT NULL,
  `password`      VARCHAR(255)  NOT NULL,
  `is_premium`    TINYINT(1)    NOT NULL DEFAULT 0,
  `berat_badan`   DECIMAL(5,2)  NULL,
  `tinggi_badan`  DECIMAL(5,2)  NULL,
  `created_at`    DATETIME      NOT NULL,
  `updated_at`    DATETIME      NOT NULL,
  `deleted_at`    DATETIME      NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. exercises — master data gerakan (dikelola Admin).
-- ----------------------------------------------------------------------------
CREATE TABLE `exercises` (
  `id`               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `nama_latihan`     VARCHAR(100)  NOT NULL,
  `kategori`         ENUM('upper body','lower body','core','cardio','full body') NOT NULL,
  `kalori_per_menit` DECIMAL(6,2)  NOT NULL,
  `is_premium_only`  TINYINT(1)    NOT NULL DEFAULT 0,
  `created_at`       DATETIME      NOT NULL,
  `updated_at`       DATETIME      NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `exercises_nama_latihan_unique` (`nama_latihan`),
  KEY `exercises_kategori_index` (`kategori`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. workout_logs — satu sesi latihan seorang user (1:N dari users).
-- ----------------------------------------------------------------------------
CREATE TABLE `workout_logs` (
  `id`           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`      INT UNSIGNED  NOT NULL,
  `tanggal`      DATE          NOT NULL,
  `total_kalori` DECIMAL(8,2)  NOT NULL DEFAULT 0,
  `catatan`      TEXT          NULL,
  `created_at`   DATETIME      NOT NULL,
  `updated_at`   DATETIME      NOT NULL,
  PRIMARY KEY (`id`),
  KEY `workout_logs_user_id_fk_index` (`user_id`),
  CONSTRAINT `fk_workout_logs_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. workout_details — TABEL PIVOT N:M (workout_logs <-> exercises) yang punya
--    kolom milik sendiri: set, repetition, durasi_menit, kalori_terbakar.
--    `set` WAJIB backtick (reserved word MySQL).
-- ----------------------------------------------------------------------------
CREATE TABLE `workout_details` (
  `id`              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `workout_log_id`  INT UNSIGNED  NOT NULL,
  `exercise_id`     INT UNSIGNED  NOT NULL,
  `set`             INT UNSIGNED  NOT NULL DEFAULT 1,
  `repetition`      INT UNSIGNED  NULL,
  `durasi_menit`    INT UNSIGNED  NULL,
  `kalori_terbakar` DECIMAL(6,2)  NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `wd_workout_log_id_fk_index` (`workout_log_id`),
  KEY `wd_exercise_id_fk_index` (`exercise_id`),
  CONSTRAINT `fk_wd_workout_log`
    FOREIGN KEY (`workout_log_id`) REFERENCES `workout_logs` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_wd_exercise`
    FOREIGN KEY (`exercise_id`) REFERENCES `exercises` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
