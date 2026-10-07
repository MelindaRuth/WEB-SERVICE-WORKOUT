# RANCANGAN — AI-Powered Workout & Habit Tracker

Dokumen analisis & rancangan untuk UTS Mata Kuliah Service Oriented Architecture (SOA) — S1 Sistem Informasi Bisnis, ISTTS.

---

## 1. Domain dan Masalah

### 1.1 Deskripsi Domain & Latar Belakang

Aplikasi ini adalah AI-Powered Workout & Habit Tracker yang bergerak di bidang health & fitness. Masalah utama yang dihadapi pengguna saat ingin memulai rutinitas olahraga adalah kebingungan dalam menentukan menu latihan (workout split) yang sesuai dengan kondisi fisik, ketersediaan waktu, dan peralatan yang dimiliki hari itu. Sebagian besar aplikasi pengacak latihan standar hanya memberikan rekomendasi yang kaku (static) tanpa mempertimbangkan tingkat kelelahan atau durasi singkat yang dimiliki pengguna.

### 1.2 Target Pengguna (User)

- **User Gratis (Free Level):** Pengguna yang ingin mencatat rutinitas latihan harian (habit tracking) dan mendapatkan rekomendasi menu latihan standar (static template) yang dikelola oleh Admin.
- **User Premium (Subscription Level):** Pengguna berbayar yang membutuhkan rekomendasi program latihan kustom secara real-time yang digenerate langsung oleh AI berdasarkan kondisi harian mereka.
- **Admin System:** Pengelola master data latihan (exercises), kategori gerakan, serta penyedia kuesioner/template menu harian standar.

### 1.3 Solusi & Skenario Penggunaan (User Flow)

Aplikasi ini memfasilitasi pencatatan dan generasi latihan yang dipersonalisasi:

- **Input Kondisi:** Pengguna memasukkan keluhan atau kondisi harian pada aplikasi (contoh: "Hari ini aku capek banget, cuma ada waktu 15 menit, mau fokus lower body pakai dumbbell").
- **Pemrosesan Layanan (Freemium Logic):**
  - Jika akun pengguna berstatus **Free**, sistem mengambil template latihan standar yang relevan dari database internal.
  - Jika akun pengguna berstatus **Premium**, sistem meneruskan request kondisi pengguna ke **Gemini API** untuk menghasilkan jadwal workout split kilat yang disesuaikan secara dinamis.
- **Output & Tracking:** Sistem menampilkan rekomendasi latihan (misal: Sumo Squats 3x12, Glute Bridges 3x15, Dumbbell Lunges 2x10). Setelah latihan diselesaikan, pengguna menekan tombol "Selesaikan Latihan". Sistem akan menghitung estimasi kalori yang terbakar dan menyimpannya ke dalam riwayat latihan (workout log) yang terhubung dengan kalender aktivitas pengguna.

### 1.4 Data yang Dikelola & Keputusan yang Dibantu

- **Data yang Dikelola:** Profil & metrik tubuh user (berat/tinggi badan), status keanggotaan (Free/Premium), master data gerakan olahraga (exercises), log riwayat latihan harian (workout logs), serta rincian set/repetisi/durasi (workout details).
- **Keputusan yang Dibantu:** Membantu pengguna mengambil keputusan latihan fisik harian yang tepat tanpa membuang waktu menyusun program sendiri, serta membantu memantau konsistensi rutinitas dan estimasi akumulasi kalori yang terbuang secara terukur.

---

## 2. ERD (Entity Relationship Diagram)

Project ini memiliki 4 tabel utama:

```
┌────────────┐        1:N        ┌────────────────┐       N:M        ┌─────────────┐
│   users    │──────────────────▶│  workout_logs  │◀────────────────▶│  exercises  │
└────────────┘   (user_id FK)    └────────────────┐  (pivot table:   └─────────────┘
                                                   │  workout_details)
                                           ┌───────┴────────┐
                                           │ workout_details│
                                           │  (pivot N:M)   │
                                           └────────────────┘
```

### Tabel `users`

| Kolom           | Tipe Data     | Keterangan                                        |
|-----------------|---------------|---------------------------------------------------|
| id              | INT (PK, AI)  | ID unik user                                      |
| nama            | VARCHAR(100)  | Nama lengkap user                                 |
| email           | VARCHAR(100)  | Email unik (identitas login)                      |
| password        | VARCHAR(255)  | Password ter-hash                                 |
| is_premium      | BOOLEAN       | Status keanggotaan (false = Free, true = Premium) |
| berat_badan     | DECIMAL(5,2)  | Berat badan dalam kilogram                        |
| tinggi_badan    | DECIMAL(5,2)  | Tinggi badan dalam sentimeter                     |
| created_at      | DATETIME      | Waktu pembuatan                                   |
| updated_at      | DATETIME      | Waktu pembaruan                                   |
| deleted_at      | DATETIME      | Soft delete (paranoid mode Sequelize)             |

### Tabel `exercises`

| Kolom            | Tipe Data     | Keterangan                                          |
|------------------|---------------|-----------------------------------------------------|
| id               | INT (PK, AI)  | ID unik gerakan                                     |
| nama_latihan     | VARCHAR(100)  | Nama gerakan (mis. "Sumo Squats")                  |
| kategori         | VARCHAR(50)   | Grup otot / kategori (upper body, lower body, core) |
| kalori_per_menit | DECIMAL(6,2)  | Estimasi kalori terbakar per menit                  |
| is_premium_only  | BOOLEAN       | true = hanya untuk user premium                     |
| created_at       | DATETIME      | Waktu pembuatan                                     |
| updated_at       | DATETIME      | Waktu pembaruan                                     |

### Tabel `workout_logs`

| Kolom       | Tipe Data     | Keterangan                                  |
|-------------|---------------|---------------------------------------------|
| id          | INT (PK, AI)  | ID unik log latihan                         |
| user_id     | INT (FK)      | Merujuk ke `users.id` (relasi 1:N)          |
| tanggal     | DATE          | Tanggal latihan dilakukan                   |
| total_kalori| DECIMAL(8,2)  | Total kalori terbakar (dihitung service)    |
| catatan     | TEXT          | Catatan/opini pengguna atas latihan         |
| created_at  | DATETIME      | Waktu pembuatan                             |
| updated_at  | DATETIME      | Waktu pembaruan                             |

### Tabel `workout_details` (Tabel Pivot N:M)

| Kolom           | Tipe Data     | Keterangan                                    |
|-----------------|---------------|-----------------------------------------------|
| id              | INT (PK, AI)  | ID unik rincian                               |
| workout_log_id  | INT (FK)      | Merujuk ke `workout_logs.id`                  |
| exercise_id     | INT (FK)      | Merujuk ke `exercises.id`                     |
| set             | INT           | Jumlah set gerakan ini                        |
| repetition      | INT           | Jumlah repetisi per set                       |
| durasi_menit    | INT           | Durasi (untuk gerakan berbasis waktu)         |
| kalori_terbakar | DECIMAL(6,2)  | Kolom milik pivot: kalori per gerakan (durasi × kalori_per_menit) |

### Penjelasan Relasi

- **Relasi 1:N — `users` → `workout_logs`:** Satu user dapat memiliki banyak workout log, tetapi setiap workout log hanya dimiliki oleh satu user (`user_id` sebagai foreign key di `workout_logs`). Di Sequelize: `User.hasMany(WorkoutLog)` dan `WorkoutLog.belongsTo(User)`.
- **Relasi N:M — `workout_logs` ↔ `exercises` via pivot `workout_details`:** Satu log latihan dapat berisi banyak gerakan, dan satu gerakan dapat muncul di banyak log. Pivot `workout_details` **tidak sekadar tabel penghubung** — ia memiliki kolom miliknya sendiri (`set`, `repetition`, `durasi_menit`, `kalori_terbakar`) yang merekam rincian eksekusi tiap gerakan dalam satu sesi latihan. Di Sequelize: `WorkoutLog.belongsToMany(Exercise, { through: WorkoutDetail })`.

---

## 3. Tabel Daftar Endpoint

Base path: `{{baseUrl}}/api/v1`. Prefix `/api/v1` menandakan versi besar kontrak API.

| #  | Method | Path                                    | Fungsi                                                                       | Sukses            | Gagal                                                |
|----|--------|-----------------------------------------|------------------------------------------------------------------------------|-------------------|------------------------------------------------------|
| 1  | POST   | `/api/v1/users`                         | Registrasi user baru                                                          | 201 + `Location`  | 400 (validasi Joi, semua field dilaporkan sekaligus)  |
| 2  | GET    | `/api/v1/users`                         | Daftar semua user (Admin) — filter `is_premium`, sort, pagination            | 200               | 404, 405, 400 (parameter query salah tipe)           |
| 3  | GET    | `/api/v1/users/:id`                     | Detail satu user beserta rekap statistiknya                                  | 200               | 404 (user tidak ditemukan), 405                      |
| 4  | PUT    | `/api/v1/users/:id`                     | Update profil & metrik tubuh user                                             | 200               | 400, 404, 405                                        |
| 5  | DELETE | `/api/v1/users/:id`                     | Soft delete user (paranoid) — ditolak jika masih ada log aktif               | 200               | 404, 409 (user masih punya workout log), 405         |
| 6  | GET    | `/api/v1/users/:id/workout-logs`        | **Nested resource:** daftar log latihan milik user tertentu                  | 200               | 404 (user tidak ditemukan), 405                      |
| 7  | GET    | `/api/v1/exercises`                     | Daftar master exercise — **filter** `kategori`, `keyword`; `sort`+`order`; `limit`+`offset` | 200 | 400, 405                                    |
| 8  | POST   | `/api/v1/exercises`                     | Admin menambah gerakan baru                                                   | 201 + `Location`  | 400 (Joi), 405, 409 (nama latihan sudah terdaftar)   |
| 9  | PATCH  | `/api/v1/exercises/:id`                 | Admin mengubah sebagian data gerakan (mis. kalori per menit)                | 200               | 400, 404, 405                                        |
| 10 | DELETE | `/api/v1/exercises/:id`                 | Hapus gerakan — ditolak jika masih dipakai workout detail                   | 200               | 404, 409 (masih dirujuk `workout_details`), 405      |
| 11 | POST   | `/api/v1/workout-logs`                  | Catat hasil latihan + rinciannya; service menghitung `total_kalori`         | 201 + `Location`  | 400 (Joi body & rincian), 404 (exercise/user tidak ada), 405 |
| 12 | GET    | `/api/v1/workout-logs/:id`              | Detail log dengan **include** `workout_details` + `exercise` (kolom pivot tampil) | 200         | 404, 405                                             |
| 13 | POST   | `/api/v1/recommendations/generate`      | **Integrasi Gemini API:** Premium → generate kustom via AI; Free → template dari DB | 200        | 400 (kondisi kosong), 409 (Free minta exercise premium-only), 502/504 (Gemini gagal/timeout) |
| 14 | GET    | `/api/v1/workout-logs/statistik`        | Rekap kalori & konsistensi harian user (agregat, versi raw query)           | 200               | 404, 405                                             |

### Aturan Bisnis (ditolak dengan 400 / 409)

1. **409 — User masih punya `workout_logs` tidak boleh dihapus** (DELETE `/api/v1/users/:id`): data riwayat latihan milik pengguna aktif tidak boleh hilang begitu saja.
2. **409 — Exercise yang masih dirujuk `workout_details` tidak boleh dihapus** (DELETE `/api/v1/exercises/:id`): master data yang dipakai transaksi tidak boleh dimatikan.
3. **409 — User Free meminta rekomendasi yang berisi exercise `is_premium_only`** (POST `/api/v1/recommendations/generate`): aturan freemium ditegakkan di sisi service, bukan frontend.
4. **400 — Input validasi Joi gagal**: semua field yang salah dilaporkan sekaligus (`abortEarly: false`), pesan berbahasa Indonesia dan menyebut nama field.

---

## 4. Dua Program yang Memanggil Service Ini

### 4.1 Single Page Application (SPA) Web Admin

Digunakan oleh **Admin System** untuk mengelola master data: menambah/mengubah gerakan `exercises`, mengatur kategori, menyusun template menu harian standar untuk user Free, serta memverifikasi/mengubah status premium user.

**Alasan membutuhkan service ini:** Admin tidak boleh mengakses database langsung. SPA butuh API yang seragam dan tervalidasi untuk CRUD master data, dan service inilah yang menjamin aturan bisnis (mis. exercise yang masih dipakai tidak bisa dihapus) tetap dijaga terlepas dari siapa yang memanggil.

### 4.2 Mobile App Tracker Client (Flutter / React Native)

Digunakan oleh **pengguna akhir (Free & Premium)** untuk mencatat log latihan harian, memanggil klaim rekomendasi latihan (termasuk yang digenerate Gemini AI), dan menampilkan grafik riwayat kalori dari kalender aktivitas.

**Alasan membutuhkan service ini:** Aplikasi mobile tidak boleh menyimpan API key Gemini maupun kredensial database di perangkat. Perhitungan kalori, logika freemium (Free → template DB, Premium → Gemini AI), dan agregasi statistik harus terpusat di satu service agar konsisten di semua perangkat dan dapat diperbarui tanpa merilis ulang aplikasi.

---

## 5. Apa yang Dikerjakan Service Ini — Tidak Didapat dari Direct 3rd Party Call

Jika frontend memanggil Gemini API secara langsung, yang kita dapatkan hanyalah teks acak dari model bahasa tanpa konteks apa pun. Service ini menambahkan lapisan nilai yang tidak bisa ditiru oleh direct call: **API key Gemini dan Midtrans terlindungi di backend** (tidak pernah turun ke HTML atau APK), **data Gemini digabungkan dengan database lokal** — rekomendasi AI dicocokkan dengan katalog `exercises` kita, divalidasi, lalu disimpan sebagai `workout_log` yang terhubung ke kalender pengguna, **logika freemium dan kuota ditegakkan di satu tempat** (user Free diarahkan ke template dari DB, hanya Premium yang diteruskan ke Gemini, sehingga biaya AI terkontrol), **estimasi kalori dihitung oleh service** berdasarkan metrik tubuh user (`berat_badan`, `tinggi_badan`) dan `kalori_per_menit` tiap gerakan — sesuatu yang mustahil diketahui Gemini, dan **struktur JSON response dikustomisasi** agar konsisten dan siap pakai oleh SPA maupun mobile, bukan format mentah upstream yang bisa berubah sewaktu-waktu. Singkatnya: 3rd party API adalah *bahan mentah*, service ini adalah *masakan* yang mengerti domain, pengguna, dan aturan bisnis kami.

---

## 6. Rancangan Kontrol Akses (Peran × Endpoint)

Rancangan ini menyiapkan jalur otentikasi JWT (belum diimplementasikan pada tahap ini, yang dinilai adalah rancangannya). Setiap request membawa `Authorization: Bearer <token>` yang berisi `user_id` dan `role` (`admin` / `user_free` / `user_premium`).

| Endpoint                               | GET            | POST               | PUT                    | PATCH                  | DELETE               |
|----------------------------------------|----------------|--------------------|------------------------|------------------------|----------------------|
| `/api/v1/users`                        | Admin          | Publik (registrasi)| —                      | —                      | —                    |
| `/api/v1/users/:id`                    | Admin / pemilik| —                  | Admin / pemilik        | Admin / pemilik        | Admin / pemilik      |
| `/api/v1/users/:id/workout-logs`       | Admin / pemilik| —                  | —                      | —                      | —                    |
| `/api/v1/exercises`                    | Semua user     | Admin              | —                      | —                      | —                    |
| `/api/v1/exercises/:id`                | Semua user     | —                  | Admin                  | Admin                  | Admin                |
| `/api/v1/workout-logs`                 | Pemilik        | Pemilik            | Pemilik                | Pemilik                | Pemilik              |
| `/api/v1/workout-logs/:id`             | Pemilik / Admin| —                  | Pemilik                | Pemilik                | Pemilik              |
| `/api/v1/recommendations/generate`     | —              | User Premium       | —                      | —                      | —                    |

### Penjelasan per Peran

- **Admin:** Dilindungi master data latihan dan daftar seluruh user — hanya Admin yang boleh mengubah katalog `exercises` dan melihat data pengguna lain, sehingga integritas template latihan dan basis pengguna tidak bisa dirusak oleh pengguna biasa.
- **User (Free/Premium):** Dilindungi privasi data kesehatan pribadinya — riwayat latihan, metrik tubuh, dan log kalori hanya boleh diakses dan dimutasi oleh pemiliknya sendiri (`user_id` pada token harus cocok dengan `:id` pada URL).
- **User Premium:** Dilindungi fitur bernilai bayar — endpoint `recommendations/generate` dengan Gemini hanya terbuka bagi token bersandang `is_premium = true`, sehingga biaya pemanggilan AI dan nilai lebih langganan premium tidak dinikmati akun gratis.

---

## 7. Pengamanan Kredensial di Cloud Environment

Saat ini kredensial (connection string MySQL, `GEMINI_API_KEY`, dsb.) disimpan di berkas `.env` di mesin pengembang, dan `.env` sudah masuk `.gitignore` sehingga tidak pernah ter-commit. Jika service ini dipasang di cloud, cara ini tidak lagi memadai: `.env` yang terbaca manusia rawan bocor lewat log CI, screenshot, atau akses server. Perubahannya, kredensial dipindahkan ke **managed secret store milik platform** — AWS Secrets Manager / AWS Parameter Store di EC2-ECS, Secret Manager di Google Cloud Platform, atau Key Vault di Azure — dan injected ke container saat runtime sebagai environment variable, bukan ditempel di image atau berkas. API key Gemini sebaiknya dibuat **rotatable** (bisa diganti berkala tanpa downtime) dan dibatasi dengan quota/budget alert di provider console, sementara koneksi ke database cloud memakai identitas terkelola (IAM database authentication / service account) sekecil mungkin haknya (least privilege), TLS diwajibkan, dan secret tidak pernah ditulis ke log — termasuk menghilangkan `logging: console` pada Sequelize di production. Dengan pendekatan ini, peredaran secret terpusat, ter-audit (siapa mengambil secret kapan), dan bisa dicabut segera saat insiden, tanpa perlu menyentuh kode aplikasi.

---

## 8. Catatan Tambahan Sesuai Tuntutan UTS

- **Nested resource:** `GET /api/v1/users/:id/workout-logs` (butir 2).
- **List + filter + sort + pagination:** `GET /api/v1/exercises?kategori=lower-body&keyword=squat&sort=kalori_per_menit&order=desc&limit=10&offset=0` — diproses dengan `Op` Sequelize, bukan `.filter()` JavaScript (butir 2 & 3).
- **Include dengan kolom pivot:** `GET /api/v1/workout-logs/:id` me-eager-load `workout_details` (lewat `belongsToMany` + `through`) sehingga `set`, `repetition`, `kalori_terbakar` milik pivot ikut ter-display; dibuktikan bebas N+1 dengan log SQL satu query (butir 3 — log SQL disertakan saat implementasi).
- **Model feature:** `User` memakai `paranoid: true` (soft delete, kolom `deleted_at`), `WorkoutLog` memakai `DataTypes.VIRTUAL` untuk `jumlah_gerakan`, `Exercise` memakai `validate` (butir 3).
- **Dual implementation:** endpoint `GET /api/v1/workout-logs/statistik` ditulis dua kali — versi ORM (sequelize-models) dan versi `sequelize.query()` dengan `replacements`. Yang dipakai di production adalah **versi raw query**, karena agregasi multi-tabel (SUM total_kalori per minggu + streak konsistensi) menghasilkan SQL yang lebih ringkas dan terukur plan-nya dibanding rantainya `findAll` + `reduce` di JavaScript; versi ORM dipertahankan sebagai pembanding dan dokumentasi (butir 3).
- **Integrasi Gemini:** panggilan keluar memakai `axios` dengan key dari `.env`; response upstream **tidak diteruskan apa adanya** — field teks AI diurai, dicocokkan dengan `exercises` di DB, dan dikeluarkan ulang dalam skema JSON service kita; timeout/non-2xx/network error dijawab **504/502** dengan fallback template dari DB sesuai status akun, server tidak pernah crash atau menggantung (butir 5).
- **Raw query** selalu memakai `replacements`/bind — tidak ada penempelan nilai langsung ke string SQL.
