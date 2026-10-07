-- ============================================================================
--  DATA AWAL (SEED) — AI-Powered Workout & Habit Tracker
--  ============================================================================
--  Jalanikan SETELAH sql/schema.sql. Angka kalori di workout_details &
--  total_kalori sudah dihitung memakai rumus service (DETIK_PER_REP=3) supaya
--  konsisten dengan yang dihasilkan POST /workout-logs.
--
--  Password (bcrypt, 10 round) — plaintext untuk uji coba:
--    user 1 (Sari,  Premium) -> "password123"
--    user 2 (Andi,  Free)    -> "rahasia123"
--    user 3 (Bima,  Free)    -> "rahasia123"
-- ============================================================================

USE `workout_tracker`;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE `workout_details`;
TRUNCATE TABLE `workout_logs`;
TRUNCATE TABLE `exercises`;
TRUNCATE TABLE `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- ---- users -----------------------------------------------------------------
INSERT INTO `users`
  (`id`, `nama`, `email`, `password`, `is_premium`, `berat_badan`, `tinggi_badan`, `created_at`, `updated_at`, `deleted_at`)
VALUES
  (1, 'Sari Wibowo', 'sari@test.com',
      '$2b$10$RnmzCO/TlujrwKu.jis0G..8X8KytdbQEEYBE4h0TDAMiPqqnLPeK',
      1, 62.50, 165.00, NOW(), NOW(), NULL),
  (2, 'Andi Pratama', 'andi@test.com',
      '$2b$10$5iF8/AsXPPS1c.CcrXjx2eylON3gf4Fm2/Z7RwJCQNnEt3A7rtkpy',
      0, 70.00, 172.00, NOW(), NOW(), NULL),
  (3, 'Bima Saputra', 'bima@test.com',
      '$2b$10$5iF8/AsXPPS1c.CcrXjx2eylON3gf4Fm2/Z7RwJCQNnEt3A7rtkpy',
      0, NULL, NULL, NOW(), NOW(), NULL);

-- ---- exercises -------------------------------------------------------------
--   3 gerakan gratis + 2 gerakan premium-only + variasi kategori untuk filter.
INSERT INTO `exercises`
  (`id`, `nama_latihan`, `kategori`, `kalori_per_menit`, `is_premium_only`, `created_at`, `updated_at`)
VALUES
  (1, 'Push Up',        'upper body', 7.00,  0, NOW(), NOW()),
  (2, 'Squat',          'lower body', 8.00,  0, NOW(), NOW()),
  (3, 'Plank',          'core',       5.00,  0, NOW(), NOW()),
  (4, 'Lari Santai',    'cardio',    10.00,  0, NOW(), NOW()),
  (5, 'Burpee',         'full body', 12.00,  0, NOW(), NOW()),
  (6, 'Muscle Up Ring', 'upper body',11.00,  1, NOW(), NOW()),
  (7, 'Dragon Flag',    'core',       9.50,  1, NOW(), NOW());

-- ---- workout_logs (2 sesi milik user 1 / Premium) --------------------------
INSERT INTO `workout_logs`
  (`id`, `user_id`, `tanggal`, `total_kalori`, `catatan`, `created_at`, `updated_at`)
VALUES
  (1, 1, '2026-10-01', 22.60, 'Push Up 3x12 + Plank 2 menit', NOW(), NOW()),
  (2, 1, '2026-10-03', 24.00, 'Hari kaki: Squat 4x15', NOW(), NOW());

-- ---- workout_details (pivot: kolom set/repetition/durasi_menit/kalori) ------
--   Log 1: Push Up  set=3 rep=12 -> 3*12*3/60 = 1.80 mnt * 7.00 = 12.60
--          Plank   durasi=2 mnt            -> 2 * 5.00          = 10.00  (total 22.60)
--   Log 2: Squat   set=4 rep=15 -> 4*15*3/60 = 3.00 mnt * 8.00  = 24.00  (total 24.00)
INSERT INTO `workout_details`
  (`id`, `workout_log_id`, `exercise_id`, `set`, `repetition`, `durasi_menit`, `kalori_terbakar`)
VALUES
  (1, 1, 1, 3, 12,   NULL, 12.60),
  (2, 1, 3, 1, NULL,    2, 10.00),
  (3, 2, 2, 4, 15,   NULL, 24.00);
