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
  (`id`, `nama`, `username`, `email`, `password`, `is_premium`, `umur`, `gender`, `berat_badan`, `tinggi_badan`, `created_at`, `updated_at`, `deleted_at`)
VALUES
  (1, 'Sari Wibowo', 'sari', 'sari@test.com',
      '$2b$10$RnmzCO/TlujrwKu.jis0G..8X8KytdbQEEYBE4h0TDAMiPqqnLPeK',
      1, 24, 'female', 62.50, 165.00, NOW(), NOW(), NULL),
  (2, 'Andi Pratama', 'andi', 'andi@test.com',
      '$2b$10$5iF8/AsXPPS1c.CcrXjx2eylON3gf4Fm2/Z7RwJCQNnEt3A7rtkpy',
      0, 27, 'male', 70.00, 172.00, NOW(), NOW(), NULL),
  (3, 'Bima Saputra', 'bima', 'bima@test.com',
      '$2b$10$5iF8/AsXPPS1c.CcrXjx2eylON3gf4Fm2/Z7RwJCQNnEt3A7rtkpy',
      0, NULL, NULL, NULL, NULL, NOW(), NOW(), NULL);

-- ---- exercises -------------------------------------------------------------
--   3 gerakan gratis + 2 gerakan premium-only + variasi kategori untuk filter.
INSERT INTO `exercises`
  (`id`, `nama_latihan`, `kategori`, `equipment`, `body_part`, `kalori_per_menit`, `is_premium_only`, `created_at`, `updated_at`)
VALUES
  (1, 'Push Up',        'upper body', 'bodyweight', 'chest',      7.00,  0, NOW(), NOW()),
  (2, 'Squat',          'lower body', 'bodyweight', 'legs',       8.00,  0, NOW(), NOW()),
  (3, 'Plank',          'core',       'bodyweight', 'core',       5.00,  0, NOW(), NOW()),
  (4, 'Lari Santai',    'cardio',     'bodyweight', 'cardio',    10.00,  0, NOW(), NOW()),
  (5, 'Burpee',         'full body',  'bodyweight', 'full body', 12.00,  0, NOW(), NOW()),
  (6, 'Muscle Up Ring', 'upper body', 'rings',      'back',      11.00,  1, NOW(), NOW()),
  (7, 'Dragon Flag',    'core',       'bodyweight', 'core',       9.50,  1, NOW(), NOW()),
  (8, 'Dumbbell Curl',  'upper body', 'dumbbell',   'arms',       6.00,  0, NOW(), NOW()),
  (9, 'Glute Bridge',   'lower body', 'bodyweight', 'glutes',     6.50,  0, NOW(), NOW()),
  (10, 'Sumo Squat',    'lower body', 'bodyweight', 'legs',       8.50,  0, NOW(), NOW()),
  (11, 'Treadmill',     'cardio',     'treadmill',  'cardio',     9.00,  0, NOW(), NOW()),
  (12, 'Dumbbell Row',  'upper body', 'dumbbell',   'back',       7.50,  0, NOW(), NOW()),
  (13, 'Lunges',        'lower body', 'bodyweight', 'legs',       7.00,  0, NOW(), NOW()),
  (14, 'Lat Pulldown',  'upper body', 'lat_pulldown', 'back',     7.00,  0, NOW(), NOW()),
  (15, 'Leg Curl',      'lower body', 'leg_curl_extension', 'legs', 6.50, 0, NOW(), NOW()),
  (16, 'Leg Extension', 'lower body', 'leg_curl_extension', 'legs', 6.50, 0, NOW(), NOW()),
  (17, 'Matras Mobility', 'core',     'matras',       'full body', 4.00, 0, NOW(), NOW());

-- ---- workout_logs (4 sesi milik user 1 / Premium) --------------------------
--   Tanggal dibuat RELATIF terhadap hari berjalan (CURDATE()) supaya streak,
--   "weekly activity" dan riwayat di frontend langsung terlihat hidup.
INSERT INTO `workout_logs`
  (`id`, `user_id`, `tanggal`, `total_kalori`, `catatan`, `created_at`, `updated_at`)
VALUES
  (1, 1, DATE_SUB(CURDATE(), INTERVAL 6 DAY), 22.60, 'Push Up 3x12 + Plank 2 menit', NOW(), NOW()),
  (2, 1, DATE_SUB(CURDATE(), INTERVAL 5 DAY), 24.00, 'Hari kaki: Squat 4x15', NOW(), NOW()),
  (3, 1, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 120.30, '@ 8kg', NOW(), NOW()),
  (4, 1, CURDATE(),                            41.86, 'Ringan tapi konsisten', NOW(), NOW());

-- ---- workout_details (pivot: kolom set/repetition/durasi_menit/kalori) ------
--   Log 1: Push Up  set=3 rep=12 -> 1.80 mnt * 7.00 = 12.60
--          Plank   durasi=2 mnt  -> 2 * 5.00        = 10.00   (total 22.60)
--   Log 2: Squat   set=4 rep=15 -> 3.00 mnt * 8.00  = 24.00   (total 24.00)
--   Log 3: Dumbbell Curl 3x12 -> 1.80 * 6.00 = 10.80 ; Glute Bridge 3x20 -> 3.00 * 6.50 = 19.50
--          Treadmill 10 menit -> 10 * 9.00 = 90.00                              (total 120.30)
--   Log 4: Lunges 3x12 -> 1.80 * 7.00 = 12.60 ; Sumo Squat 3x15 -> 2.25 * 8.50 = 19.13
--          Dumbbell Row 3x10 -> 1.35 * 7.50 = 10.13                              (total 41.86)
INSERT INTO `workout_details`
  (`id`, `workout_log_id`, `exercise_id`, `set`, `repetition`, `durasi_menit`, `kalori_terbakar`)
VALUES
  (1, 1, 1,  3, 12,   NULL, 12.60),
  (2, 1, 3,  1, NULL,    2, 10.00),
  (3, 2, 2,  4, 15,   NULL, 24.00),
  (4, 3, 8,  3, 12,   NULL, 10.80),
  (5, 3, 9,  3, 20,   NULL, 19.50),
  (6, 3, 11, 1, NULL,   10, 90.00),
  (7, 4, 13, 3, 12,   NULL, 12.60),
  (8, 4, 10, 3, 15,   NULL, 19.13),
  (9, 4, 12, 3, 10,   NULL, 10.13);
