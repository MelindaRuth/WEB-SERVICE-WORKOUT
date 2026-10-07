# SYSTEM RULES & ATURAN PROYEK UTS SOA

Kamu adalah senior backend developer. Tolong ikuti seluruh aturan berikut dalam menulis kode Express.js:

1. ARSITEKTUR KODE:
   - Wajib menggunakan struktur folder: routes/, controllers/, models/, middlewares/, dan config/.
   - File `index.js` di root HANYA untuk mounting express dan routes. Dilarang ada logika bisnis di index.js.
   - Dilarang keras ada logika `if` atau `.filter()` di dalam folder `routes/`.

2. VALIDASI & KEAMANAN:
   - Gunakan Joi untuk semua POST, PUT, PATCH.
   - Joi Wajib menggunakan option `{ abortEarly: false }`.
   - Pesan error Joi WAJIB Bahasa Indonesia dan menyebutkan nama field-nya.
   - Dilarang menyimpan `req.body` langsung ke database. Objek yang dimasukkan ke DB harus dibentuk ulang dari field yang lolos validasi.
   - Simpan API Key dan kredensial DB di `.env`. Sertakan `.env.example` di repo.

3. SEQUELIZE & DATABASE:
   - Model dibuat di folder `models/` secara terpisah dan di-export via `models/index.js`.
   - Model `User` wajib menggunakan `paranoid: true` (soft delete).
   - Terdapat relasi: User 1:N WorkoutLog, WorkoutLog N:M Exercise via pivot WorkoutDetail.
   - Alias `as` pada asosiasi Sequelize HARUS konsisten dengan nama key JSON response.
   - Query filter wajib pakai `Op` dari Sequelize, dilarang filter manual JavaScript.

4. INTEGRASI GEMINI API:
   - Panggil Gemini API memakai `axios`.
   - Tangani error upstream (timeout, error 5xx) dan berikan response 502/504 tanpa crash server.

5. REFERENSI MATERI KELAS:
   - Ikuti style koding dan pola error handling yang ada di folder `class-materials/`.