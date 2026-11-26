USE `workout_tracker`;

CREATE TABLE IF NOT EXISTS `exercise_media` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `exercise_id` INT UNSIGNED NOT NULL,
  `media_type` ENUM('image','gif','video') NOT NULL DEFAULT 'image',
  `url` VARCHAR(500) NOT NULL,
  `thumbnail_url` VARCHAR(500) NULL,
  `source` ENUM('upload','text_to_image','external') NOT NULL DEFAULT 'upload',
  `prompt` TEXT NULL,
  `status` ENUM('pending','ready','failed') NOT NULL DEFAULT 'ready',
  `is_primary` TINYINT(1) NOT NULL DEFAULT 0,
  `credit` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `exercise_media_exercise_index` (`exercise_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `users`
  (`nama`,`username`,`email`,`password`,`is_premium`,`role`,`created_at`,`updated_at`)
VALUES
  ('Administrator','admin','admin@fitai.local',
   '$2b$10$RnmzCO/TlujrwKu.jis0G..8X8KytdbQEEYBE4h0TDAMiPqqnLPeK',
   0,'admin',NOW(),NOW());

CREATE TABLE IF NOT EXISTS `equipments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(60) NOT NULL,
  `description` TEXT NULL,
  `icon` VARCHAR(20) NOT NULL DEFAULT '🏋️',
  `aliases` JSON NOT NULL,
  `category` VARCHAR(40) NOT NULL DEFAULT 'other',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `equipments_name_unique` (`name`),
  UNIQUE KEY `equipments_slug_unique` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pricing_plans` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(40) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `price` DECIMAL(12,2) NOT NULL,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'IDR',
  `duration_days` INT UNSIGNED NOT NULL,
  `features` JSON NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pricing_plans_code_unique` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_transactions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` VARCHAR(100) NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `plan_id` INT UNSIGNED NOT NULL,
  `plan_name_snapshot` VARCHAR(100) NOT NULL,
  `amount_snapshot` DECIMAL(12,2) NOT NULL,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'IDR',
  `status` VARCHAR(30) NOT NULL DEFAULT 'pending',
  `paid_at` DATETIME NULL,
  `premium_starts_at` DATETIME NULL,
  `premium_expires_at` DATETIME NULL,
  `signature_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `raw_status` JSON NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `payment_transactions_order_unique` (`order_id`),
  KEY `payment_transactions_user_index` (`user_id`),
  KEY `payment_transactions_plan_index` (`plan_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admin_action_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `admin_id` INT UNSIGNED NOT NULL,
  `action` VARCHAR(50) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` INT UNSIGNED NULL,
  `before_data` JSON NULL,
  `after_data` JSON NULL,
  `ip_address` VARCHAR(45) NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `refresh_sessions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `family_id` CHAR(64) NOT NULL,
  `revoked_at` DATETIME NULL,
  `revoked_reason` VARCHAR(80) NULL,
  `expires_at` DATETIME NOT NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(500) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `refresh_sessions_token_hash_unique` (`token_hash`),
  KEY `refresh_sessions_user_index` (`user_id`),
  KEY `refresh_sessions_family_index` (`family_id`),
  CONSTRAINT `fk_refresh_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `equipments`
  (`name`,`slug`,`description`,`icon`,`aliases`,`category`,`is_active`,`sort_order`,`created_at`,`updated_at`)
VALUES
  ('Bodyweight','bodyweight','Gerakan tanpa alat atau beban eksternal','🧍',JSON_ARRAY('body weight','bw','tanpa alat'),'bodyweight',1,10,NOW(),NOW()),
  ('Dumbbell','dumbbell','Alat beban bebas','🏋️',JSON_ARRAY('dumbbells','db'),'free_weight',1,20,NOW(),NOW()),
  ('Barbell','barbell','Alat beban batang','🏋️',JSON_ARRAY('barbells'),'free_weight',1,30,NOW(),NOW()),
  ('Treadmill','treadmill','Mesin kardio jalan atau lari','🏃',JSON_ARRAY('running machine'),'cardio',1,40,NOW(),NOW()),
  ('Resistance Band','resistance_band','Pita elastis resistensi','➰',JSON_ARRAY('band','resistance bands'),'band',1,50,NOW(),NOW()),
  ('Kettlebell','kettlebell','Beban kettlebell','🔔',JSON_ARRAY('kettlebells','kb'),'free_weight',1,60,NOW(),NOW()),
  ('Gym Ball','gym_ball','Bola stabilitas latihan','⚽',JSON_ARRAY('stability ball','exercise ball','swiss ball'),'functional',1,70,NOW(),NOW()),
  ('Lat Pulldown','lat_pulldown','Mesin tarik ke bawah','🔩',JSON_ARRAY('mesin lat pulldown','lat pulldown','cable pulldown'),'machine',1,80,NOW(),NOW()),
  ('Leg Curl/Extension','leg_curl_extension','Mesin leg curl atau leg extension','🦵',JSON_ARRAY('leg curl','leg extension','leg curl extension'),'machine',1,90,NOW(),NOW()),
  ('Matras','matras','Matras lantai untuk mobility dan core','🧘',JSON_ARRAY('yoga mat','exercise mat'),'bodyweight',1,100,NOW(),NOW()),
  ('Rings','rings','Cincin gymnastic','◯',JSON_ARRAY('ring','gymnastic rings'),'calisthenics',1,110,NOW(),NOW());

INSERT IGNORE INTO `pricing_plans`
  (`code`,`name`,`description`,`price`,`currency`,`duration_days`,`features`,`is_active`,`sort_order`,`created_at`,`updated_at`)
VALUES
  ('premium_monthly','Premium Bulanan','Rekomendasi AI dan custom equipment selama 30 hari',25000.00,'IDR',30,
   JSON_ARRAY('AI Coach','Custom Equipment','4-5 hari workout split'),1,10,NOW(),NOW());
