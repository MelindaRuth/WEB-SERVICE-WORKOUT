# AI-Powered Workout & Habit Tracker — Backend REST Service

Service REST (SOA) untuk pelacak kebiasaan olahraga dengan rekomendasi program
berbasis AI. Dibangun dengan **Express 5 + Sequelize 6 + MySQL**, memvalidasi
input lewat **Joi**, melindungi kredensial dengan **bcrypt**, dan mengintegrasikan
**Google Gemini** sebagai *third-party API* untuk pengguna Premium (dengan fallback
database bila upstream gagal).

Rancangan lengkap (ERD, kontrak API, aturan bisnis) ada di [`RANCANGAN.md`](./RANCANGAN.md).

---

## 1. Teknologi

| Komponen   | Versi  | Peran                                   |
|------------|--------|-----------------------------------------|
| Node.js    | v22.x  | Runtime                                 |
| Express    | ^5.2   | HTTP framework (error async native)     |
| Sequelize  | ^6.37  | ORM MySQL                               |
| mysql2     | ^3.24  | Driver + skrip migrasi                  |
| Joi        | ^18.2  | Validasi request (`abortEarly:false`)   |
| bcryptjs   | ^3.0   | Hashing password (10 rounds)            |
| axios      | ^1.20  | Panggilan keluar ke Gemini              |
| dotenv     | ^18.0  | Kredensial dari `.env`                  |
| Bootstrap  | ^5.3   | UI frontend (disajikan dari `node_modules`) |

---

## 2. Prasyarat

- **Node.js 18+** (disarankan 22) dan **npm**.
- **MySQL 8** berjalan lokal (XAMPP/Laragon/instansi mandiri). Cukup server MySQL
  yang menyala; **tidak wajib** punya MySQL CLI — migrasi dijalankan lewat Node.

---

## 3. Menjalankan Project (mulai cepat)

```bash
# 1) Install dependensi
npm install

# 2) Buat file konfigurasi lokal
#    (salin contoh lalu sesuaikan kredensial MySQL kalian)
copy .env.example .env      # Windows
# cp .env.example .env      # Linux/macOS

# 3) Bangun database + tabel + data awal (idempoten, bisa diulang)
npm run migrate

# 4) Nyalakan server
npm start                   # atau: npm run dev  (nodemon, auto-reload)
```

Server default mendengarkan `http://localhost:3000` (lihat `PORT` di `.env`).
Cek hidup: `GET http://localhost:3000/` → informasi service.

### Cara alternatif membuat tabel (auto-sync)

Jika **tidak** menjalankan langkah 3, server tetap bisa menyiapkan struktur DB saat
menyala selama `DB_AUTOSYNC=true` (bawaan dev). Saat startup service akan:

1. `CREATE DATABASE IF NOT EXISTS` (sehingga MySQL yang benar-benar kosong pun siap),
2. `sequelize.sync()` — **hanya membuat tabel yang belum ada**, tidak pernah
   menghapus/menimpa data (aman untuk pengembangan).

Set `DB_AUTOSYNC=false` bila ingin server tidak menyentuh struktur DB dan kalian
mengelola skema murni lewat `sql/schema.sql`.

> Beda jalur: `npm run migrate` = schema **dan** seed data awal (reset penuh).
> `sequelize.sync()` = hanya tabel, tanpa seed. Pilih salah satu; keduanya aman.

### Perintah npm

| Perintah             | Efek                                                       |
|----------------------|------------------------------------------------------------|
| `npm start`          | Jalankan server (`node index.js`)                          |
| `npm run dev`        | Jalankan server dengan nodemon (auto-reload)               |
| `npm run migrate`    | `CREATE DATABASE` + `schema.sql` + `seed.sql` (reset penuh)|
| `npm run migrate schema` | Hanya rebuild tabel (tanpa seed)                       |
| `npm run seed`       | Hanya isi ulang data awal (tabel harus sudah ada)          |

---

## 4. Mengisi `.env`

Semua konfigurasi dibaca dari variabel lingkungan. **Jangan** commit `.env`
(sudah ada di `.gitignore`). Isi `.env` dari `.env.example`:

| Variabel           | Contoh nilai              | Keterangan                                                        |
|--------------------|---------------------------|-------------------------------------------------------------------|
| `PORT`             | `3000`                    | Port HTTP server                                                   |
| `NODE_ENV`         | `development`             | Lingkungan berjalan                                               |
| `DB_HOST`          | `127.0.0.1`               | Host MySQL                                                          |
| `DB_PORT`          | `3306`                    | Port MySQL                                                          |
| `DB_USER`          | `root`                    | User MySQL                                                          |
| `DB_PASS`          | *(kosongkan bila tanpa sandi)* | Password MySQL                                               |
| `DB_NAME`          | `workout_tracker`         | Nama database (dibuat otomatis oleh migrate/autosync)              |
| `DB_AUTOSYNC`      | `true`                    | `true` → sync tabel saat startup; `false` → andalkan `npm run migrate` |
| `GEMINI_API_KEY`   | `AIza...`                 | Kunci API Gemini. **Placeholder** → jalur Premium mengembalikan 502 + fallback |
| `GEMINI_MODEL`     | `gemini-1.5-flash`        | Model Gemini yang dipakai                                         |
| `GEMINI_TIMEOUT_MS`| `8000`                    | Batas waktu panggilan Gemini (ms). Melewati → 504 + fallback       |
| `DETIK_PER_REP`    | `3`                       | Estimasi detik/repetisi untuk hitung kalori gerakan berbasis set   |

**Kredensial rahasia tidak pernah ditulis di kode** — hanya dari `.env`.

---

## 5. Daftar Endpoint

Prefix dasar: **`/api/v1`**. Format response konsisten:
`{ "status": "success" | "fail" | "error", "message"?, "data"?, "errors"? }`.

### Users (`/api/v1/users`)

| Method   | Path                              | Deskripsi                                   | Sukses | Error                      |
|----------|-----------------------------------|---------------------------------------------|--------|----------------------------|
| `POST`   | `/api/v1/users`                   | Registrasi user baru (password di-hash)     | 201    | 400 (validasi), 409 (email)|
| `POST`   | `/api/v1/users/login`             | **Login**: cocokkan kredensial dengan hash bcrypt (scope `withPassword`) | 200 | 400 (validasi), **401** (email/password salah) |
| `GET`    | `/api/v1/users`                   | Daftar user: `?is_premium=&sort=&order=&limit=&offset=` | 200 | —        |
| `GET`    | `/api/v1/users/:id`               | Detail user + workout log-nya               | 200    | 404                        |
| `PUT`    | `/api/v1/users/:id`               | Update profil / **upgrade premium**         | 200    | 400, 404                   |
| `DELETE` | `/api/v1/users/:id`               | Soft delete (paranoid)                       | 200    | 404, 409 (masih punya log) |
| `GET`    | `/api/v1/users/:id/workout-logs`  | **Nested**: log latihan milik satu user      | 200    | 404                        |

> Field profil yang bisa diubah lewat `PUT /users/:id`: `username`, `nama`, `umur`,
> `gender` (`male`/`female`), `berat_badan`, `tinggi_badan`, `is_premium`. Semua field
> ini juga tersedia di **halaman Frontend** (modal profil).
>
> Login memakai **satu pesan 401** untuk email tak dikenal maupun password salah (tidak
> membocorkan akun mana yang terdaftar), dicocokkan case-insensitive pada email, dan
> responsnya tidak pernah memuat `password`.

### Exercises (`/api/v1/exercises`)

| Method   | Path                     | Deskripsi                                            | Sukses | Error                     |
|----------|--------------------------|------------------------------------------------------|--------|---------------------------|
| `GET`    | `/api/v1/exercises`      | Daftar + filter `?kategori=&keyword=&sort=&order=&limit=&offset=` | 200 | —            |
| `POST`   | `/api/v1/exercises`      | Tambah gerakan (master data Admin)                    | 201    | 400, 409 (nama kembar)     |
| `PATCH`  | `/api/v1/exercises/:id`  | Update sebagian (tanpa default yang menyelinap)        | 200    | 400, 404                  |
| `DELETE` | `/api/v1/exercises/:id`  | Hapus gerakan                                         | 200    | 404, 409 (masih dirujuk)   |

> Tidak ada `GET /exercises/:id` — memanggilnya menghasilkan **405** dengan header `Allow: PATCH, DELETE`.

### Workout Logs (`/api/v1/workout-logs`)

| Method | Path                             | Deskripsi                                                        | Sukses | Error                          |
|--------|----------------------------------|-----------------------------------------------------------------|--------|--------------------------------|
| `POST` | `/api/v1/workout-logs`           | Catat 1 sesi + `details[]` (N:M via pivot, kalori dihitung service) | 201  | 400, 404 (user/exercise), 409 (freemium) |
| `GET`  | `/api/v1/workout-logs/statistik` | **Agregat raw SQL**: `?user_id=&mulai=&sampai=` (WAJIB sebelum `/:id`) | 200 | 400 (tanpa `user_id`)          |
| `GET`  | `/api/v1/workout-logs/:id`       | Detail log + exercises + **kolom pivot** (`set`, dst.)           | 200    | 404                            |

### Recommendation (`/api/v1/recommendations`) — integrasi Gemini

| Method | Path                                | Deskripsi                                                        | Sukses | Error                          |
|--------|-------------------------------------|-----------------------------------------------------------------|--------|--------------------------------|
| `POST` | `/api/v1/recommendations/generate`  | Free → template DB (200). Premium → Gemini; upstream gagal → fallback | 200 | 400, 404 (user), **502/504** (upstream) |

### Payments (`/api/v1/payments`) — integrasi Midtrans (Snap)

| Method | Path                            | Deskripsi                                                                 | Sukses | Error                                        |
|--------|---------------------------------|---------------------------------------------------------------------------|--------|----------------------------------------------|
| `POST` | `/api/v1/payments/transaction`  | Buat transaksi upgrade premium → `snap_token` + `redirect_url` (order_id `PREM-<user_id>-<ts>`) | 201    | 400 (validasi), 404 (user), 409 (sudah premium), **502** (Midtrans tak terjangkau), 503 (key kosong) |
| `POST` | `/api/v1/payments/notification` | **Webhook** Midtrans; verifikasi `signature_key` (SHA-512) → `settlement`/`capture` menaikkan `is_premium` (idempoten) | 200    | 400 (nominal/order_id), **403** (signature salah) |

> Tidak ada method lain pada kedua path ini — `GET` menghasilkan **405** dengan header `Allow: POST`.

### Info

| Method | Path | Deskripsi                    | Sukses |
|--------|------|------------------------------|--------|
| `GET`  | `/`  | Penanda hidup + daftar route | 200    |

---

## 6. Postman Collection (butir 6 UTS)

Berkas di folder [`postman/`](./postman):

- `workout-tracker.postman_collection.json` — **54 request** tersusun rapi per folder (00-Info s.d. **06-Payments**), **seluruhnya punya test**.
- `local.postman_environment.json` — environment dengan `baseUrl`, `MIDTRANS_SERVER_KEY`, & `premiumAmount`.

**Cara pakai:** Postman → **Import** → pilih kedua berkas → pilih environment
*Workout Tracker - Local*. Pastikan server hidup (`npm start`), lalu **Runner**
(Ikon ▶ "Run collection") untuk menjalankan seluruh rangkaian berurutan.

Yang diuji otomatis (tab **Tests**):

- **Code status**: 200, 201, 400, 404, 405, 409, serta 502/504 (jalur fallback Gemini).
- **`baseUrl` variable**: satu titik konfigurasi untuk seluruh request.
- **Variable chaining**: ID hasil `POST` (`userId`, `exerciseId`, `premiumExerciseId`,
  `logId`, dst.) disimpan ke collection variable dan dipakai request berikutnya
  (mis. `GET /users/:id` → `PUT` → buat log → hapus).
- **Anti mass-assignment**: registrasi dikirim dengan body berisi `isAdmin:true` &
  `is_premium:true`; test menegaskan `isAdmin` **tidak** muncul, `is_premium`
  **dipaksa false**, dan `password` **tidak pernah** dibocorkan di response.
- **Login (folder 01 - Users)**: `POST /users/login` diuji **200** (akun seed; response tanpa
  `password`), **401** password salah, **401** email tidak terdaftar dengan **pesan identik**
  (tidak membocorkan akun mana yang ada), **400** (email salah format + password kosong), dan
  `GET /users/login` → **405** sebagai bukti rute `/login` terdaftar sebelum `/:id`.
- **Kolom pivot**: reading `set`/`repetition` pada `workout_details` (via `detail.get("set")`).
- **Bukti Butir 3 & 4 (request tambahan)**: `GET /workout-logs/statistik` **RAW vs `?mode=orm`**
  (test membandingkan angka **identik** — parity dual-implementation), `GET /workout-logs/1`
  (bukti **N+1**: cukup 1 query SELECT+JOIN, terlihat di log `[SQL]` server), dan `POST /users`
  ber-**body JSON rusak** → 400 pesan aman (bukti **tidak membocorkan stack/SQL** ke klien).
- **Webhook Midtrans (folder 06 - Payments)**: skenario **Free → Premium didemokan LOKAL** tanpa menyentuh
  Midtrans — **Pre-request script (CryptoJS)** menghitung `signature_key = SHA512(order_id + status_code +
  gross_amount + MIDTRANS_SERVER_KEY)` secara otomatis, jadi notifikasi `settlement` diterima (200) dan user
  naik premium (terverifikasi via `GET /users/:id`). Uji lain: 400 (tanpa `user_id`), 404 (user tak ada),
  405 (`GET /transaction`), 403 (signature palsu). Permintaan `transaction` sukses **201** hanya bila
  `MIDTRANS_SERVER_KEY` diisi kunci sandbox asli; tanpa itu membalas **502** (test menerima keduanya).

> Catatan: dengan `GEMINI_API_KEY` berupa placeholder, request Premium sengaja
> membalas **502** (`UPSTREAM_ERROR`) + `fallback_database` — ini membuktikan
> service tidak crash saat pihak ketiga gagal.

---

## 7. Struktur Proyek

```
.
├── index.js                 # Titik masuk: HANYA merakit middleware/router/server
├── config                   # (via src/config) koneksi Sequelize + sync
├── scripts/
│   └── migrate.js           # CREATE DATABASE + schema.sql + seed.sql
├── sql/
│   ├── schema.sql           # DDL 4 tabel (cermin src/models)
│   └── seed.sql             # Data awal (user, exercise, log + pivot)
├── postman/                 # Collection + environment
├── public/                  # Frontend (HTML + CSS + JS, Bootstrap 5, vanilla)
│   ├── index.html           # Shell SPA: topbar, 4 halaman, bottom nav, 2 modal
│   ├── css/style.css        # Tema FITAI (dark default + light, mobile-first)
│   ├── js/                  # api.js, app.js (router & halaman), demo-assets.js
│   └── assets/demo/         # Rak GIF/video contoh gerakan (lihat bagian 7.2)
├── RANCANGAN.md             # Perancangan lengkap sistem
└── src/
    ├── config/database.js   # instance Sequelize, testConnection, syncDatabase
    ├── models/              # User, Exercise, WorkoutLog, WorkoutDetail, index(asosiasi)
    ├── middlewares/         # validation(Joi), errorHandler, logger, notFound, methodNotAllowed
    ├── controllers/         # user, exercise, workoutLog, recommendation
    └── routes/              # user, exercise, workoutLog, recommendation, index
```

Alur permintaan: **route → middleware validasi → controller → model (ORM) → MySQL**.
`index.js` hanya merakit; tidak ada logika bisnis di route; controller tidak pernah
menyimpan `req.body` mentah (memakai `req.validated` hasil Joi).

---

## 7.1 Frontend (folder `public/`)

Satu server yang sama menyajikan API **dan** aplikasinya. Bootstrap 5 diambil dari
`node_modules` (route `/vendor/bootstrap`), jadi tetap jalan tanpa internet; hanya
font Google yang bersifat opsional.

```bash
npm run migrate && npm start
# buka  http://localhost:3000/app   (atau /index.html)
```

`GET /` tetap mengembalikan JSON informasi service (kontrak Postman tidak berubah);
UI berada di `/app`.

| Halaman (hash route) | Endpoint yang dipakai                                                            |
|----------------------|----------------------------------------------------------------------------------|
| **Auth** (sebelum masuk) | `POST /users/login` (tab MASUK), `POST /users` (tab DAFTAR), lalu `GET /users/:id` |
| **Home** `#/home`    | `GET /users/:id` (log ikut terbawa) — streak, statistik, weekly activity, body metrics, recent sessions + **toggle dark/light** |
| **Log** `#/log`      | `GET /exercises`, `POST /exercises` (mode CUSTOM), `POST /workout-logs`            |
| **AI Coach** `#/coach` | `POST /recommendations/generate` (Free = template DB, Premium = Gemini + fallback 502/504) |
| **Progress** `#/progress` | `GET /workout-logs/statistik`, `GET /users/:id/workout-logs`, `GET /workout-logs/:id` |
| **Profil** (tombol kanan atas) | `PUT /users/:id` — username, gender (male/female), umur, berat & tinggi badan |

Catatan implementasi frontend:

- **Dark mode adalah default**; pilihan tema disimpan di `localStorage` (`fitai_theme`).
- **Login & registrasi diverifikasi server**: layar Auth memakai tab MASUK/DAFTAR dan memanggil
  `POST /users/login` — password dibandingkan dengan hash bcrypt di backend, jadi kredensial
  tidak pernah diperiksa di browser.
- Akun aktif (id user) disimpan di `localStorage` (`fitai_user_id`) sebagai penanda sesi,
  karena service ini belum memakai JWT; `#btnLogout` menghapusnya.
- Grid gerakan mendukung **multi-select**: satu klik “LOG” = satu sesi berisi semua gerakan
  yang dipilih (relasi N:M lewat `workout_details`).
- Kolom beban (`WEIGHT (KG)`) tidak ada di skema service, maka dikirim sebagai `catatan`
  sesi, mis. `"@ 8kg"`.
- Semua teks yang disisipkan ke DOM melewati `esc()` (anti XSS), dan error backend
  (pesan Joi Bahasa Indonesia) ditampilkan apa adanya lewat toast/modal.

## 7.2 Rak Contoh Gerakan (GIF / Video) di Halaman LOG

Halaman LOG sudah punya rak pratinjau contoh gerakan: panel media dengan rasio 16:9
(di antara grid gerakan dan input SETS), tombol `▶` di setiap kartu untuk membuka
versi besar di modal, dan tombol **PERBESAR**. Rak ini sengaja dibuat *siap-aset*:
kalau file belum tersedia, yang muncul hanyalah placeholder berisi emoji + lokasi
file yang harus diisi, sehingga ukuran layout tidak berubah.

Cara menambahkan aset (pilih salah satu, tanpa mengubah kode UI):

1. **Konvensi nama file** — taruh aset di `public/assets/demo/` dengan nama slug
   latihan: `squat.gif`, `dumbbell-curl.mp4`, `treadmill.webm`. UI menguji ekstensi
   berurutan `.gif → .mp4 → .webm` lewat HEAD request yang hasilnya di-cache,
   jadi satu file yang belum ada hanya diperiksa sekali per sesi.
2. **Peta eksplisit** pada `DEMO_ASSETS` di `public/js/demo-assets.js` — dipakai bila
   nama file tidak mengikuti konvensi atau asetnya URL eksternal:

```js
const DEMO_ASSETS = {
  "dumbbell curl": { src: "/assets/demo/bicep.gif" },
  "treadmill":     { src: "/assets/demo/lari.mp4", poster: "/assets/demo/lari.jpg", credit: "Sumber: …" },
  "plank":         { src: "https://…/plank.gif" },
};
```

Catatan implementasi:

- Tipe media ditebak dari ekstensi: `mp4/webm/mov` dirender sebagai
  `<video controls autoplay muted loop playsinline>`, lainnya sebagai `<img>` (GIF).
- Pratinjau mengikuti kartu yang dipilih / yang sedang mendapat fokus keyboard, dan
  juga nama yang sedang diketik saat mode CUSTOM aktif.
- Token async terpisah untuk rak dan modal, sehingga hasil probe lama tidak menimpa
  tampilan yang baru.
- `public/assets/demo/_sample-squat.svg` hanyalah animasi contoh (placeholder) untuk
  membuktikan jalur render bekerja — hapus entri `squat` di `DEMO_ASSETS` begitu GIF
  gerakan yang sebenarnya dimasukkan.

---

## 8. Aturan Bisnis Penting

- **Freemium**: user **Free** tidak boleh mencatat gerakan `is_premium_only` → **409**.
  Upgrade `is_premium` hanya lewat `PUT /users/:id` (jalur Admin/pembayaran), bukan
  saat registrasi.
- **Kalori dihitung server** (`total_kalori`, `kalori_terbakar`), tidak dipercaya dari
  klien. Gerakan berbasis `set × repetition × DETIK_PER_REP / 60`, atau `durasi_menit`.
- **Soft delete user** (paranoid): `DELETE` hanya mengisi `deleted_at`; user yang masih
  punya log aktif tidak bisa dihapus (→ 409).
- **Integritas master data**: `exercise` yang masih dirujuk `workout_details` tidak bisa
  dihapus (→ 409).
- **Keamanan error**: `errorHandler` memusatkan response error tanpa membocorkan
  stack/nama tabel/SQL ke klien.

---

## 9. Pemecahan Masalah

| Gejala                                   | Penyebab & solusi                                                       |
|------------------------------------------|-------------------------------------------------------------------------|
| `Unknown database 'workout_tracker'`     | Jalankan `npm run migrate` (atau biarkan `DB_AUTOSYNC=true` saat start). |
| `ECONNREFUSED 127.0.0.1:3306`            | MySQL belum menyala / `DB_PORT` salah. Nyalakan server MySQL.            |
| `[SQL] Not overriding built-in method ...: set` | Wajar: kolom pivot `set` bentrok dgn method Sequelize. Data & JSON tetap benar; baca via `get("set")`. |
| Jalur Premium selalu 502                 | `GEMINI_API_KEY` belum diisi asli — memang intended (fallback).          |
