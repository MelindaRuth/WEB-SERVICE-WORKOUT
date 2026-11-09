/**
 * FITAI — FRONTEND APP
 * ====================
 * SPA sederhana (hash router) yang memakai seluruh endpoint /api/v1:
 *   users (list/get/put) · exercises (list/create) · workout-logs
 *   (create/get/statistik/nested) · recommendations/generate (Gemini)
 *
 * Pembagian isi file:
 *   1. util & state      5. halaman LOG
 *   2. tema & shell      6. halaman AI COACH
 *   3. router            7. halaman PROGRESS
 *   4. halaman AUTH      8. modal PROFIL
 */

/* ==================================================================== */
/* 1. UTIL & STATE                                                       */
/* ==================================================================== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const LS = { user: "fitai_user_id", theme: "fitai_theme" };

const state = {
  user: null,
  logs: [], // ringkasan: { id, tanggal, total_kalori, catatan }
  details: {}, // logId -> log lengkap (dengan exercises + kolom pivot)
  exercises: [],
  exerciseFilters: { equipment: "", body_part: "" },
  history: { from: "", to: "", keyword: "", equipment: "", body_part: "", offset: 0 },
  draft: { selectedIds: [], previewId: null, custom: false, namaCustom: "", set: 3, rep: 12, unit: "reps", weight: "" },
  coach: { durasi: 20, peralatan: ["Dumbbell"], note: "", result: null, error: null },
};

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => toISO(new Date());
const parseISO = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00`);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Tue, Nov 3" */
const fmtDate = (d) => `${DAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
const fmtDateUpper = (d) => fmtDate(d).toUpperCase();

/** Sapaan sesuai jam perangkat. */
const greeting = () => {
  const h = new Date().getHours();
  if (h < 11) return "GOOD MORNING,";
  if (h < 15) return "GOOD AFTERNOON,";
  if (h < 19) return "GOOD EVENING,";
  return "GOOD NIGHT,";
};

const EMOJI_RULES = [
  ["curl", "🏋️"], ["squat", "🦵"], ["sumo", "🦵"], ["lunge", "🦵"], ["leg", "🦵"],
  ["bridge", "🍑"], ["glute", "🍑"], ["treadmill", "🏃"], ["lari", "🏃"], ["run", "🏃"],
  ["cardio", "🏃"], ["push", "💪"], ["bench", "💪"], ["plank", "⏱️"], ["core", "⏱️"],
  ["row", "🚣"], ["burpee", "🤸"], ["muscle", "💪"], ["dragon", "🐉"], ["band", "🎗️"],
  ["kettle", "🔔"], ["jump", "🦘"], ["yoga", "🧘"], ["sit", "🧎"], ["bike", "🚴"],
];
const exEmoji = (name) => {
  const n = String(name || "").toLowerCase();
  const hit = EMOJI_RULES.find(([k]) => n.includes(k));
  return hit ? hit[1] : "🏋️";
};

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const dayWord = (n) => (n === 1 ? "day" : "days");

/** Baris ringkas satu rincian: "3 × 12 reps" / "2 menit". */
const detailLabel = (d) => {
  const pivot = d.WorkoutDetail || d.workout_detail || {};
  const set = num(pivot.set, 1);
  if (pivot.repetition) return `${set} × ${pivot.repetition} reps`;
  if (pivot.durasi_menit) return `${set} × ${pivot.durasi_menit} menit`;
  return `${set} set`;
};

function toast(message, variant = "success") {
  const el = $("#fitToast");
  $("#fitToastBody").textContent = message;
  el.classList.remove("text-bg-success", "text-bg-danger", "text-bg-dark");
  el.classList.add(variant === "danger" ? "text-bg-danger" : variant === "info" ? "text-bg-dark" : "text-bg-success");
  bootstrap.Toast.getOrCreateInstance(el, { delay: 3200 }).show();
}

const spinnerBlock = (label = "Memuat data…") =>
  `<div class="text-center py-5">
     <div class="spinner-border" role="status"></div>
     <p class="fit-mono mt-3 mb-0">${esc(label)}</p>
   </div>`;

const errorBlock = (message, retryLabel = "COBA LAGI") =>
  `<div class="fit-card text-center py-4">
     <div style="font-size:1.6rem">⚠️</div>
     <p class="mt-2 mb-3">${esc(message)}</p>
     <button class="btn fit-chip" id="btnRetry">${esc(retryLabel)}</button>
   </div>`;

/* ==================================================================== */
/* 2. TEMA & SHELL                                                       */
/* ==================================================================== */

const applyTheme = (theme) => {
  document.documentElement.setAttribute("data-bs-theme", theme);
  localStorage.setItem(LS.theme, theme);
  $("#themeIcon").textContent = theme === "dark" ? "🌙" : "☀️";
  $("#btnTheme").title = theme === "dark" ? "Ganti ke light mode" : "Ganti ke dark mode";
  $$(".fit-theme-opt").forEach((b) => b.classList.toggle("active", b.dataset.theme === theme));
};

const toggleTheme = () =>
  applyTheme(document.documentElement.getAttribute("data-bs-theme") === "dark" ? "light" : "dark");

const currentTheme = () => localStorage.getItem(LS.theme) || "dark"; // default: dark

function bindShell() {
  $("#btnTheme").addEventListener("click", toggleTheme);

  // Satu listener untuk semua aset demo: kalau file belum ada (404), coba
  // ekstensi berikutnya dari daftar kandidat, lalu jatuh ke placeholder.
  document.addEventListener(
    "error",
    (e) => {
      const el = e.target;
      if (el && el.classList && el.classList.contains("fit-demo-media")) demoMediaGagal(el);
    },
    true // error resource TIDAK bubble, jadi wajib pakai capture
  );
}

function updateTopbar() {
  if (!state.user) return;
  $("#avatarLetter").textContent = (state.user.username || state.user.nama || "F").slice(0, 1).toUpperCase();
  $("#topStreak").textContent = hitungStreak(state.logs);
}

/* ==================================================================== */
/* 3. ROUTER                                                             */
/* ==================================================================== */

const ROUTES = { home: renderHome, log: renderLog, coach: renderCoach, progress: renderProgress };

const currentRoute = () => {
  const raw = (location.hash || "#/home").replace(/^#\/?/, "").split("?")[0];
  return ROUTES[raw] ? raw : "home";
};

async function renderRoute() {
  const route = currentRoute();
  $$("#bottomnav .nav-item").forEach((a) => a.classList.toggle("active", a.dataset.route === route));
  const app = $("#app");
  app.innerHTML = spinnerBlock();
  window.scrollTo({ top: 0, behavior: "smooth" });
  try {
    await ROUTES[route](app);
  } catch (err) {
    app.innerHTML = errorBlock(err.message || "Gagal memuat halaman");
    $("#btnRetry")?.addEventListener("click", renderRoute);
  }
}

/* ==================================================================== */
/* DATA ACCESS                                                           */
/* ==================================================================== */

/** Muat user + seluruh log ringkasnya (endpoint GET /users/:id sudah include). */
async function loadUser(id) {
  const res = await api.getUser(id);
  state.user = res.data;
  state.logs = res.data.workout_logs || [];
  state.details = {};
  $("#bottomnav").hidden = false;
  updateTopbar();
}

async function refreshLogs() {
  const res = await api.getUser(state.user.id);
  state.user = res.data;
  state.logs = res.data.workout_logs || [];
  updateTopbar();
}

/** Log lengkap (dengan exercises + kolom pivot), di-cache per id. */
async function logDetail(logId) {
  if (!state.details[logId]) {
    const res = await api.getLog(logId);
    state.details[logId] = res.data;
  }
  return state.details[logId];
}

const logsOnDate = (iso) => state.logs.filter((l) => String(l.tanggal).slice(0, 10) === iso);

/** Sesi berturut-turut sampai hari ini (hari tanpa log memutus rantai). */
function hitungStreak(logs) {
  const dates = new Set(logs.map((l) => String(l.tanggal).slice(0, 10)));
  let cursor = new Date();
  if (!dates.has(toISO(cursor))) cursor = addDays(cursor, -1); // hari ini boleh belum mencatat
  let streak = 0;
  while (dates.has(toISO(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Group log per tanggal, terbaru dulu: [{ iso, date, logs:[...] }] */
function groupByDate(logs) {
  const map = new Map();
  logs.forEach((l) => {
    const iso = String(l.tanggal).slice(0, 10);
    if (!map.has(iso)) map.set(iso, []);
    map.get(iso).push(l);
  });
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([iso, rows]) => ({ iso, date: parseISO(iso), logs: rows }));
}

/* ==================================================================== */
/* 4. HALAMAN AUTH (login / daftar)                                      */
/* ==================================================================== */

// Kredensial akun CONTOH yang berasal dari sql/seed.sql. Fungsinya hanya
// mempercepat uji coba (mengetik manual tetap bebas); kalau seed diubah atau
// password diganti, tombol ini tinggal memperbarui daftar di bawah.
const AKUN_CONTOH = [
  { email: "sari@test.com", password: "password123", label: "SARI · PREMIUM" },
  { email: "andi@test.com", password: "rahasia123", label: "ANDI · FREE" },
  { email: "bima@test.com", password: "rahasia123", label: "BIMA · FREE" },
];

/** Kumpulkan pesan Joi per field menjadi satu baris; fallback ke pesan umum. */
function pesanValidasi(err) {
  const perField = err.errors && Object.values(err.errors).flat().join(" · ");
  return perField || err.message || "Terjadi kesalahan";
}

function alertAuth(pesan, jenis = "danger") {
  return `<div class="alert alert-${jenis} py-2 mb-3" style="font-size:.85rem" role="alert">${esc(
    pesan
  )}</div>`;
}

function renderAuth(message, tab = "login") {
  $("#bottomnav").hidden = true;
  const app = $("#app");
  app.innerHTML = `
    <div class="fit-auth">
      <p class="fit-mono mb-1">${tab === "login" ? "MASUK KE" : "BUAT AKUN BARU DI"}</p>
      <h1 class="fit-display fit-page-title mb-3">FITAI</h1>

      <div class="d-flex gap-2 mb-3" role="tablist" aria-label="Masuk atau daftar">
        <button type="button" class="btn fit-chip ${tab === "login" ? "active" : ""}"
                role="tab" aria-selected="${tab === "login"}" data-authtab="login">MASUK</button>
        <button type="button" class="btn fit-chip ${tab === "register" ? "active" : ""}"
                role="tab" aria-selected="${tab === "register"}" data-authtab="register">DAFTAR</button>
      </div>

      <div id="authMessage">${message ? alertAuth(message) : ""}</div>
      <div id="authForm"></div>
    </div>`;

  $$("[data-authtab]").forEach((b) =>
    b.addEventListener("click", () => renderAuth(null, b.dataset.authtab))
  );

  if (tab === "login") tampilFormLogin();
  else tampilFormRegister();
}

function templateKredensial(nama, tipe, placeholder, autocomplete, extra = "") {
  const password = tipe === "password";
  return `
    <label class="fit-mono form-label" for="${nama}">${nama.toUpperCase()}</label>
    <div class="position-relative">
      <input class="form-control fit-input ${password ? "pe-5" : ""}" id="${nama}" name="${nama}" type="${tipe}"
             placeholder="${placeholder}" autocomplete="${autocomplete}" ${extra} />
      ${
        password
          ? `<button type="button" class="fit-input-toggle" data-lihat-password aria-pressed="false"
                   aria-label="Tampilkan atau sembunyikan ${nama}">👁</button>`
          : ""
      }
    </div>`;
}

/* ------------------------------- LOGIN ------------------------------- */
function tampilFormLogin() {
  $("#authForm").innerHTML = `
    <div class="fit-card">
      <form id="formLogin" novalidate>
        ${templateKredensial("email", "email", "email@contoh.com", "username", "required")}
        <div class="mt-3">${templateKredensial("password", "password", "••••••••", "current-password", "required")}</div>
        <button class="btn fit-btn-primary mt-3" type="submit">MASUK</button>
      </form>
    </div>

    <div class="fit-card mt-3">
      <div class="fit-mono mb-2" style="font-size:.62rem">ATAU PAKAI AKUN CONTOH (SEED)</div>
      <div class="d-flex flex-wrap gap-2">
        ${AKUN_CONTOH.map(
          (a) => `<button type="button" class="btn fit-chip py-0 px-2" data-isi-kredensial
                       data-email="${esc(a.email)}" data-password="${esc(a.password)}">${esc(a.label)}</button>`
        ).join("")}
      </div>
      <p class="fit-auth-note mt-2 mb-0">Klik untuk mengisi otomatis, lalu tekan MASUK.</p>
    </div>`;

  const form = $("#formLogin");
  bindSakelarPassword(form);

  $$("[data-isi-kredensial]").forEach((b) =>
    b.addEventListener("click", () => {
      form.email.value = b.dataset.email;
      form.password.value = b.dataset.password;
      form.password.focus();
    })
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("[type=submit]");
    const body = Object.fromEntries(new FormData(form).entries());
    await kirimAuth(form, btn, "MASUK", () => api.login(body));
  });
}

/* ----------------------------- REGISTER ---------------------------- */
function tampilFormRegister() {
  $("#authForm").innerHTML = `
    <div class="fit-card">
      <form id="formRegister" novalidate>
        <div class="row g-2">
          <div class="col-6">
            <label class="fit-mono form-label" for="nama">NAMA</label>
            <input class="form-control fit-input" id="nama" name="nama" placeholder="Nama Lengkap"
                   minlength="3" maxlength="100" autocomplete="name" required />
          </div>
          <div class="col-6">
            <label class="fit-mono form-label" for="username">USERNAME</label>
            <input class="form-control fit-input" id="username" name="username" placeholder="opsional"
                   minlength="3" maxlength="50" autocomplete="username" />
          </div>
        </div>

        <div class="mt-3">${templateKredensial("email", "email", "email@contoh.com", "username", "required")}</div>
        <div class="mt-3">${templateKredensial("password", "password", "min. 8 karakter", "new-password", "minlength='8' required")}</div>
        <div class="mt-3">${templateKredensial("konfirmasi", "password", "sama seperti di atas", "new-password", "required")}</div>

        <button class="btn fit-btn-primary mt-3" type="submit">DAFTAR &amp; MASUK</button>
        <p class="fit-auth-note mt-3 mb-0">
          Username boleh dikosongkan — otomatis diambil dari prefix email.
          Berat, tinggi, umur, dan gender diisi kemudian lewat menu profil.
          Akun baru selalu mulai sebagai <code>FREE</code>.
        </p>
      </form>
    </div>`;

  const form = $("#formRegister");
  bindSakelarPassword(form);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Cek cocok di klien lebih dulu: hemat satu round-trip ke server.
    const { email, nama, username, password, konfirmasi } = Object.fromEntries(
      new FormData(form).entries()
    );
    if (password !== konfirmasi) {
      tampilkanAuthError(form, "Field konfirmasi password harus sama dengan password");
      return;
    }

    const btn = form.querySelector("[type=submit]");
    const body = { nama, email, password };
    if (username) body.username = username; // backend menurunkan dari email bila kosong
    await kirimAuth(form, btn, "DAFTAR & MASUK", () => api.register(body));
  });
}

/* ------------------------- UTIL PENGIRIMAN AUTH --------------------- */
/** Sakelar 👁 pada semua field password di dalam satu form. */
function bindSakelarPassword(form) {
  $$("[data-lihat-password]", form).forEach((tombol) => {
    tombol.addEventListener("click", () => {
      const input = tombol.previousElementSibling;
      const tampil = input.type === "password";
      input.type = tampil ? "text" : "password";
      tombol.setAttribute("aria-pressed", String(tampil));
      tombol.textContent = tampil ? "🙈" : "👁";
      input.focus();
    });
  });
}

function tampilkanAuthError(form, pesan) {
  $("#authMessage").innerHTML = alertAuth(pesan);
  $("#authMessage").scrollIntoView({ block: "nearest" });
  form.querySelector("[type=submit]")?.focus();
}

/** Kirim form auth; sukses = langsung masuk, gagal = pesan per field. */
async function kirimAuth(form, btn, labelAwal, panggilApi) {
  $("#authMessage").innerHTML = "";
  btn.disabled = true;
  btn.textContent = "MEMERIKSA…";
  try {
    const res = await panggilApi();
    await masukUser(res.data.id); // toast sambutan sudah ada di masukUser()
    return res;
  } catch (err) {
    tampilkanAuthError(form, err.status === 401 ? err.message : pesanValidasi(err));
    btn.disabled = false;
    btn.textContent = labelAwal;
  }
}

async function masukUser(id) {
  localStorage.setItem(LS.user, String(id));
  // Draft LOG & hasil coach milik akun sebelumnya tidak boleh ikut ke akun baru.
  state.draft = {
    selectedIds: [],
    previewId: null,
    custom: false,
    namaCustom: "",
    set: 3,
    rep: 12,
    unit: "reps",
    weight: "",
  };
  state.coach.result = null;
  state.coach.error = null;
  await loadUser(id);
  location.hash = "#/home";
  await renderRoute();
  toast(`Halo, ${state.user.username || state.user.nama}! 👋`);
}

/* ==================================================================== */
/* 5. HALAMAN HOME                                                       */
/* ==================================================================== */

async function renderHome(app) {
  const u = state.user;
  const today = todayISO();
  const nama = (u.username || u.nama || "athlete").toUpperCase();

  const totalSesi = state.logs.length;
  const tujuhHari = [...Array(7)].map((_, i) => toISO(addDays(new Date(), i - 6)));
  const hariAktif = new Set(state.logs.map((l) => String(l.tanggal).slice(0, 10)));
  const thisWeek = tujuhHari.filter((d) => hariAktif.has(d)).length;
  const kaloriHariIni = logsOnDate(today).reduce((s, l) => s + num(l.total_kalori), 0);

  const groups = groupByDate(state.logs).slice(0, 3);
  for (const g of groups) {
    g.exercises = (await Promise.all(g.logs.map((l) => logDetail(l.id)))).flatMap((d) => d.exercises || []);
  }

  const berat = num(u.berat_badan);
  const tinggi = num(u.tinggi_badan);
  const umur = num(u.umur);

  app.innerHTML = `
    <section class="fit-hero">
      <div>
        <p class="fit-mono mb-1">${greeting()}</p>
        <h1 class="fit-display fit-page-title">${esc(nama)}</h1>
      </div>
      <div class="text-end">
        <p class="fit-mono mb-1">TODAY</p>
        <div class="fit-display" style="font-size:1rem;color:var(--fit-lime)">${fmtDateUpper(new Date())}</div>
      </div>
    </section>

    <div class="d-flex justify-content-end mb-2">
      <div class="d-flex gap-1">
        <button class="btn fit-chip fit-theme-opt" data-theme="dark">🌙 DARK</button>
        <button class="btn fit-chip fit-theme-opt" data-theme="light">☀️ LIGHT</button>
      </div>
    </div>

    <div class="fit-streak-card mb-2">
      <div>
        <p class="fit-mono mb-1">CURRENT STREAK</p>
        <div class="fit-streak-value">${hitungStreak(state.logs)} <span style="font-size:1rem">${dayWord(hitungStreak(state.logs))}</span></div>
      </div>
      <div class="fit-streak-fire">🔥</div>
    </div>

    <div class="fit-stat-grid">
      <div class="fit-stat">
        <p class="fit-mono mb-1">TOTAL SESSIONS</p>
        <div class="fit-stat-value">${totalSesi}</div>
      </div>
      <div class="fit-stat ${thisWeek ? "fit-card-accent" : ""}">
        <p class="fit-mono mb-1">THIS WEEK</p>
        <div class="fit-stat-value" style="color:var(--fit-lime)">${thisWeek} <span class="fit-stat-unit">${dayWord(thisWeek)}</span></div>
      </div>
      <div class="fit-stat">
        <p class="fit-mono mb-1">TODAY</p>
        <div class="fit-stat-value">${Math.round(kaloriHariIni)} <span class="fit-stat-unit">kcal</span></div>
      </div>
    </div>

    <h2 class="fit-section-title">Weekly Activity</h2>
    <div class="fit-week-grid">
      ${tujuhHari
        .map((iso) => {
          const d = parseISO(iso);
          const aktif = hariAktif.has(iso);
          const isToday = iso === today;
          return `<div>
            <div class="fit-week-cell ${aktif ? "is-active" : ""} ${isToday ? "is-today" : ""}" title="${fmtDate(d)}${aktif ? " · aktif" : ""}"></div>
            <span class="fit-week-label">${DAY_SHORT[d.getDay()]}</span>
          </div>`;
        })
        .join("")}
    </div>

    <h2 class="fit-section-title">Body Metrics</h2>
    <div class="fit-metric-grid">
      <div class="fit-card">
        <p class="fit-mono mb-1">WEIGHT</p>
        <div class="fit-stat-value">${berat || "—"} <span class="fit-stat-unit">kg</span></div>
        <div class="fit-bar"><span style="width:${berat ? Math.min((berat / 150) * 100, 100) : 0}%"></span></div>
      </div>
      <div class="fit-card">
        <p class="fit-mono mb-1">HEIGHT</p>
        <div class="fit-stat-value">${tinggi || "—"} <span class="fit-stat-unit">cm</span></div>
        <div class="fit-bar is-orange"><span style="width:${tinggi ? Math.min((tinggi / 200) * 100, 100) : 0}%"></span></div>
      </div>
    </div>
    <p class="fit-mono mt-2" style="font-size:.65rem">
      ${u.gender ? `GENDER: ${esc(u.gender).toUpperCase()}` : "GENDER: BELUM DIISI"} · UMUR: ${umur || "—"} · ${u.is_premium ? "PREMIUM ✦" : "FREE"}
    </p>

    <h2 class="fit-section-title">Recent Sessions</h2>
    <div id="homeRecent">
      ${
        groups.length
          ? groups
              .map(
                (g) => `<div class="fit-list-item">
                  <div>
                    <div class="fit-display" style="font-size:.9rem">${fmtDateUpper(g.date)}</div>
                    <div class="fit-mono">${g.exercises.length || g.logs.length} exercises · ${Math.round(
                  g.logs.reduce((s, l) => s + num(l.total_kalori), 0)
                )} kcal</div>
                  </div>
                  <div class="fit-emoji-row">${
                    g.exercises.slice(0, 3).map((e) => exEmoji(e.nama_latihan)).join("") || "💪"
                  }</div>
                </div>`
              )
              .join("")
          : `<div class="fit-card text-center py-4">
               <p class="fit-mono mb-2">BELUM ADA LATIHAN TERCATAT</p>
               <a href="#/log" class="btn fit-chip">+ CATAT SEKARANG</a>
             </div>`
      }
    </div>

    <div class="d-flex gap-2 mt-4">
      <a href="#/log" class="btn fit-btn-primary flex-fill">+ LOG WORKOUT</a>
      <a href="#/coach" class="btn fit-chip flex-fill">✦ AI COACH</a>
    </div>`;

  $$(".fit-theme-opt").forEach((b) => b.addEventListener("click", () => applyTheme(b.dataset.theme)));
  applyTheme(currentTheme());
}

/* ==================================================================== */
/* 5b. HALAMAN LOG                                                       */
/* ==================================================================== */

const KATEGORI_CUSTOM = "full body";
const KALORI_CUSTOM = 7;
const EQUIPMENT_FILTER_OPTIONS = [
  ["bodyweight", "Tanpa alat"],
  ["dumbbell", "Dumbbell"],
  ["barbell", "Barbell"],
  ["treadmill", "Treadmill"],
  ["resistance_band", "Resistance band"],
  ["kettlebell", "Kettlebell"],
  ["rings", "Rings"],
  ["other", "Lainnya"],
];
const BODY_PART_FILTER_OPTIONS = [
  ["chest", "Dada"],
  ["back", "Punggung"],
  ["shoulders", "Bahu"],
  ["arms", "Lengan"],
  ["core", "Core"],
  ["glutes", "Glutes"],
  ["legs", "Kaki"],
  ["cardio", "Kardio"],
  ["full body", "Seluruh tubuh"],
];

const labelEquipment = (value) =>
  EQUIPMENT_FILTER_OPTIONS.find(([key]) => key === value)?.[1] || value || "Tanpa alat";
const labelBodyPart = (value) =>
  BODY_PART_FILTER_OPTIONS.find(([key]) => key === value)?.[1] || value || "Seluruh tubuh";

/* --------------------------------------------------------------------------
 * RAK CONTOH GERAKAN (GIF / VIDEO)
 * Peta aset & konvensi nama file: public/js/demo-assets.js + public/assets/demo/
 * ------------------------------------------------------------------------ */

/** Gerakan yang sedang ditampilkan di rak demo. */
function previewDemo() {
  const d = state.draft;
  if (d.custom) return { id: null, nama_latihan: d.namaCustom || "" };
  const id = d.previewId ?? d.selectedIds[d.selectedIds.length - 1];
  return state.exercises.find((e) => e.id === Number(id)) || state.exercises[0] || null;
}

function templateDemoHead(nama) {
  return `
    <div class="fit-demo-head">
      <div class="fit-demo-name">${esc(nama || "PILIH GERAKAN UNTUK MELIHAT CONTOH")}</div>
      <button type="button" class="btn fit-chip py-0 px-2" id="btnDemoPerbesar">PERBESAR</button>
    </div>`;
}

/** Shell sinkron (dipakai saat render halaman); isinya diisi perbaruiDemoPanel(). */
function templateDemoPanel() {
  const ex = previewDemo();
  return `${templateDemoHead(ex?.nama_latihan || "")}${templateDemoLoading()}`;
}

function templateDemoLoading() {
  return `
    <div class="fit-demo-media-wrap is-loading">
      <div class="fit-demo-empty"><p class="fit-mono mb-0">MEMUAT CONTOH…</p></div>
    </div>`;
}

let demoPanelToken = 0;
let demoModalToken = 0;

/** Isi ulang hanya rak demo (tanpa render ulang seluruh halaman). */
async function perbaruiDemoPanel() {
  const panel = $("#demoPanel");
  if (!panel) return;
  const nama = previewDemo()?.nama_latihan || "";
  const token = ++demoPanelToken;
  const media = await isiDemo(nama);
  // Abaikan hasil lama bila pengguna sudah pindah pilihan / pindah halaman.
  if (token !== demoPanelToken || $("#demoPanel") !== panel) return;
  panel.innerHTML = `${templateDemoHead(nama)}${media}`;
}

/** File gagal dimuat: coba kandidat ekstensi lain, terakhir baru placeholder. */
function demoMediaGagal(el) {
  const wrap = el.closest(".fit-demo-media-wrap");
  if (!wrap) return;

  const kandidat = (wrap.dataset.kandidat || "").split(",").filter(Boolean);
  const sisa = kandidat.slice(kandidat.indexOf(el.getAttribute("src") || "") + 1);

  if (sisa.length > 0) {
    const src = sisa[0];
    if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(src)) {
      const video = document.createElement("video");
      video.className = "fit-demo-media";
      video.src = src;
      video.controls = true;
      video.autoplay = true;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      el.replaceWith(video);
    } else {
      el.src = src; // bila masih 404, listener error memanggil fungsi ini lagi
    }
    return;
  }

  const nama = wrap.dataset.demoNama || "";
  wrap.outerHTML = templateDemoPlaceholder(nama, exEmoji(nama), demoSlug(nama));
}

let demoModalInstance = null;

function templateModalDemo(nama, media) {
  return `
    ${media}
    <p class="fit-mono mt-2 mb-0" style="font-size:.62rem">VOLUME DITULIS DI FORM LOG</p>`;
}

async function bukaDemoModal(ex) {
  if (!ex) return;
  const nama = ex.nama_latihan || "";
  $("#modalDemoLabel").textContent = nama || "Custom";
  $("#modalDemoBody").innerHTML = templateModalDemo(nama, templateDemoLoading());

  const btnPilih = $("#modalDemoPick");
  btnPilih.dataset.id = ex.id || "";
  btnPilih.dataset.nama = nama;
  btnPilih.hidden = !ex.id;
  btnPilih.textContent = state.draft.selectedIds.includes(ex.id)
    ? "✓ TERPILIH · BATAL"
    : "+ PILIH GERAKAN INI";

  demoModalInstance = demoModalInstance || new bootstrap.Modal($("#modalDemo"));
  demoModalInstance.show();

  const token = ++demoModalToken;
  const media = await isiDemo(nama, { besar: true });
  // Token khusus modal: hasil lama dibuang hanya bila modal sudah dibuka lagi.
  if (token !== demoModalToken) return;
  $("#modalDemoBody").innerHTML = templateModalDemo(nama, media);
}

function bindDemoModal() {
  $("#modalDemoPick").addEventListener("click", (e) => {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;

    if (state.draft.selectedIds.includes(id)) {
      state.draft.selectedIds = state.draft.selectedIds.filter((x) => x !== id);
    } else {
      state.draft.selectedIds = [...state.draft.selectedIds, id];
      state.draft.previewId = id;
      state.draft.custom = false; // kembalikan katalog agar pilihan terlihat
    }
    e.currentTarget.blur(); // hindari fokus terjebak di dalam modal
    demoModalInstance?.hide();
    renderRoute();
  });
}

async function renderLog(app) {
  const d = state.draft;
  const res = await api.listExercises({ limit: 100, ...state.exerciseFilters });
  state.exercises = res.data;

  const today = todayISO();
  const groupsToday = groupByDate(state.logs.filter((l) => String(l.tanggal).slice(0, 10) === today));
  for (const g of groupsToday) {
    g.exercises = (await Promise.all(g.logs.map((l) => logDetail(l.id)))).flatMap((x) => x.exercises || []);
  }
  const jumlahHariIni = groupsToday.reduce((s, g) => s + g.exercises.length, 0);

  app.innerHTML = `
    <section class="fit-hero">
      <div>
        <p class="fit-mono mb-1">LOGGING FOR</p>
        <h1 class="fit-display fit-page-title">${fmtDateUpper(new Date())}</h1>
      </div>
    </section>

    <div class="fit-card">
      <div class="d-flex align-items-center justify-content-between mb-3">
        <h2 class="fit-display mb-0" style="font-size:1rem">ADD EXERCISE</h2>
        <div class="d-flex align-items-center gap-2">
          <span class="fit-badge-lime ${d.selectedIds.length ? "" : "d-none"}" id="pickCount">${d.selectedIds.length} picked</span>
          <button class="btn fit-chip ${d.custom ? "active" : ""}" id="btnCustom">CUSTOM</button>
        </div>
      </div>

      <p class="fit-mono mb-2" style="font-size:.62rem">Pilih satu atau lebih gerakan untuk satu sesi</p>

      <div class="row g-2 mb-3" aria-label="Filter gerakan">
        <div class="col-6">
          <label class="fit-mono form-label" for="filterEquipment">EQUIPMENT</label>
          <select class="form-select fit-input" id="filterEquipment">
            <option value="">Semua equipment</option>
            ${EQUIPMENT_FILTER_OPTIONS.map(
              ([value, label]) => `<option value="${value}" ${state.exerciseFilters.equipment === value ? "selected" : ""}>${esc(label)}</option>`
            ).join("")}
          </select>
        </div>
        <div class="col-6">
          <label class="fit-mono form-label" for="filterBodyPart">BAGIAN TUBUH</label>
          <select class="form-select fit-input" id="filterBodyPart">
            <option value="">Semua bagian</option>
            ${BODY_PART_FILTER_OPTIONS.map(
              ([value, label]) => `<option value="${esc(value)}" ${state.exerciseFilters.body_part === value ? "selected" : ""}>${esc(label)}</option>`
            ).join("")}
          </select>
        </div>
      </div>

      <div id="exercisePicker" class="fit-ex-grid mb-3" ${d.custom ? "hidden" : ""}>
        ${state.exercises
          .map((e) => {
            const terkunci = e.is_premium_only && !state.user.is_premium;
            const terpilih = d.selectedIds.includes(e.id);
            // Kartu = div[role=button] agar tombol ▶ di dalamnya tidak jadi
            // <button> di dalam <button> (HTML invalid + tidak bisa di-tab).
            return `<div class="fit-ex-btn ${terpilih ? "active" : ""} ${terkunci ? "is-locked" : ""}"
                         data-id="${e.id}" role="button" tabindex="${terkunci ? -1 : 0}"
                         aria-pressed="${terpilih}" ${terkunci ? "aria-disabled='true' title='Khusus premium'" : ""}>
                      <span class="ex-emoji">${terkunci ? "🔒" : exEmoji(e.nama_latihan)}</span>
                      <span>${esc(e.nama_latihan)}<small class="fit-mono d-block">${esc(labelEquipment(e.equipment))} · ${esc(labelBodyPart(e.body_part))}</small></span>
                      ${
                        terkunci
                          ? ""
                          : `<button type="button" class="fit-ex-demo" data-demo-id="${e.id}"
                                   aria-label="Lihat contoh gerakan ${esc(e.nama_latihan)}">▶</button>`
                      }
                    </div>`;
          })
          .join("")}
      </div>

      <div id="customBox" ${d.custom ? "" : "hidden"} class="mb-3">
        <input class="form-control fit-input" id="customName" placeholder="Exercise name…"
               value="${esc(d.namaCustom)}" minlength="3" maxlength="100" />
        <p class="fit-mono mt-2 mb-0" style="font-size:.62rem">
          Nama baru akan disimpan sebagai exercise katalog (kategori: ${KATEGORI_CUSTOM}, ${KALORI_CUSTOM} kcal/menit)
        </p>
      </div>

      <div class="fit-demo" id="demoPanel">${templateDemoPanel()}</div>

      <div class="row g-2">
        <div class="col-6">
          <div class="fit-mono form-label">SETS</div>
          <input type="number" class="form-control fit-input" id="inSet" min="1" max="20" value="${d.set}" />
        </div>
        <div class="col-6">
          <div class="d-flex justify-content-between align-items-center">
            <div class="fit-mono form-label">${d.unit === "reps" ? "REPS" : "MENIT"}</div>
            <div class="d-flex gap-1">
              <button class="btn fit-chip py-0 px-2 ${d.unit === "reps" ? "active" : ""}" data-unit="reps">REPS</button>
              <button class="btn fit-chip py-0 px-2 ${d.unit === "durasi" ? "active" : ""}" data-unit="durasi">MIN</button>
            </div>
          </div>
          <input type="number" class="form-control fit-input" id="inRep" min="1" max="600" value="${d.rep}" />
        </div>
      </div>

      <div class="row g-2 mt-1">
        <div class="col-6">
          <div class="fit-mono form-label">WEIGHT (KG) OPTIONAL</div>
          <input type="number" class="form-control fit-input" id="inWeight" min="0.5" max="500" step="0.5"
                 placeholder="—" value="${d.weight}" />
        </div>
      </div>

      <button class="btn fit-btn-primary mt-3" id="btnLog" type="button">+ LOG EXERCISE</button>
      <div class="text-danger small mt-2" id="logError"></div>
    </div>

    <div class="d-flex align-items-center justify-content-between mt-4 mb-2">
      <h2 class="fit-section-title mb-0">Today's Log</h2>
      <span class="fit-badge-lime">${jumlahHariIni} exercises</span>
    </div>
    <div id="todayList">
      ${
        jumlahHariIni
          ? groupsToday
              .map(
                (g) => g.exercises
                  .map(
                    (e) => `<div class="fit-list-item">
                      <span class="ex-emoji" style="font-size:1.2rem">${exEmoji(e.nama_latihan)}</span>
                      <div class="flex-fill">
                        <div class="fit-display" style="font-size:.85rem">${esc(e.nama_latihan)}</div>
                        <div class="fit-mono">${esc(detailLabel(e))}${e.WorkoutDetail?.kalori_terbakar ? ` · ${Math.round(num(e.WorkoutDetail.kalori_terbakar))} kcal` : ""}</div>
                      </div>
                    </div>`
                  )
                  .join("")
              )
              .join("")
          : `<div class="fit-card text-center py-4"><p class="fit-mono mb-0">BELUM ADA LATIHAN HARI INI</p></div>`
      }
    </div>`;

  /* ------------------------------ wiring ------------------------------ */
  $("#btnCustom").addEventListener("click", () => {
    state.draft.custom = !state.draft.custom;
    renderLog(app);
  });

  $("#filterEquipment").addEventListener("change", (e) => {
    state.exerciseFilters.equipment = e.target.value;
    renderLog(app);
  });
  $("#filterBodyPart").addEventListener("change", (e) => {
    state.exerciseFilters.body_part = e.target.value;
    renderLog(app);
  });

  // Kartu gerakan: klik ▶ = lihat contoh, klik badan kartu = pilih/deselect.
  $("#exercisePicker")?.addEventListener("click", (e) => {
    // Tombol ▶ kecil: buka modal contoh gerakan, bukan memilih latihan.
    const pemicuDemo = e.target.closest("[data-demo-id]");
    if (pemicuDemo) {
      state.draft.previewId = Number(pemicuDemo.dataset.demoId);
      perbaruiDemoPanel();
      bukaDemoModal(state.exercises.find((x) => x.id === state.draft.previewId));
      return;
    }

    const btn = e.target.closest("[data-id]");
    if (!btn || btn.classList.contains("is-locked")) return;
    const id = Number(btn.dataset.id);
    // Multi-select: satu sesi bisa berisi beberapa gerakan sekaligus.
    state.draft.selectedIds = state.draft.selectedIds.includes(id)
      ? state.draft.selectedIds.filter((x) => x !== id)
      : [...state.draft.selectedIds, id];
    state.draft.previewId = id;
    btn.classList.toggle("active");
    btn.setAttribute("aria-pressed", String(btn.classList.contains("active")));
    perbaruiJumlahPilih();
    perbaruiDemoPanel();
  });

  // Kartu sekarang div[role=button], jadi Enter/Space ditangani manual.
  $("#exercisePicker")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const btn = e.target.closest("[data-id]");
    if (!btn || btn.classList.contains("is-locked")) return;
    e.preventDefault();
    btn.click();
  });

  // Fokus/keyboard pada kartu juga memindahkan pratinjau demo.
  $("#exercisePicker")?.addEventListener("focusin", (e) => {
    const btn = e.target.closest("[data-id]");
    if (!btn || btn.classList.contains("is-locked")) return;
    state.draft.previewId = Number(btn.dataset.id);
    perbaruiDemoPanel();
  });

  $("#demoPanel")?.addEventListener("click", (e) => {
    if (!e.target.closest("#btnDemoPerbesar")) return;
    bukaDemoModal(previewDemo());
  });

  const perbaruiJumlahPilih = () => {
    const badge = $("#pickCount");
    if (!badge) return;
    const n = state.draft.selectedIds.length;
    badge.textContent = `${n} picked`;
    badge.classList.toggle("d-none", n === 0);
    $("#btnLog").textContent = n > 1 ? `+ LOG ${n} EXERCISES` : "+ LOG EXERCISE";
  };

  $("#customName")?.addEventListener("input", (e) => {
    state.draft.namaCustom = e.target.value;
    perbaruiDemoPanel(); // pratinjau ikut nama yang sedang diketik
  });

  $$("[data-unit]").forEach((b) =>
    b.addEventListener("click", () => {
      state.draft.unit = b.dataset.unit;
      state.draft.rep = b.dataset.unit === "reps" ? 12 : 5;
      renderLog(app);
    })
  );

  $("#inSet").addEventListener("input", (e) => (state.draft.set = num(e.target.value, 1)));
  $("#inRep").addEventListener("input", (e) => (state.draft.rep = num(e.target.value, 1)));
  $("#inWeight").addEventListener("input", (e) => (state.draft.weight = e.target.value));

  $("#btnLog").addEventListener("click", () => simpanLog(app));
  perbaruiJumlahPilih(); // pulihkan badge & label tombol setelah render ulang
  perbaruiDemoPanel(); // isi rak contoh gerakan (probe file GIF/MP4)
}

async function simpanLog(app) {
  const d = state.draft;
  const errBox = $("#logError");
  errBox.textContent = "";

  const btn = $("#btnLog");
  btn.disabled = true;
  btn.textContent = "MENYIMPAN…";

  try {
    // Kumpulan id gerakan: dari grid (bisa lebih dari satu) + dari mode CUSTOM.
    const ids = [...state.draft.selectedIds];

    if (d.custom) {
      const nama = d.namaCustom.trim();
      if (nama.length < 3) throw new Error("Field nama_latihan minimal 3 karakter");
      ids.push(await pastikanExercise(nama));
    }

    const unik = [...new Set(ids)];
    if (!unik.length) throw new Error("Pilih gerakan dulu, atau aktifkan mode CUSTOM");

    const volume = { set: Math.max(1, d.set) };
    if (d.unit === "reps") volume.repetition = Math.max(1, d.rep);
    else volume.durasi_menit = Math.max(1, d.rep);

    const body = {
      user_id: state.user.id,
      tanggal: todayISO(),
      // SATU POST = SATU SESI berisi semua gerakan yang dipilih (relasi N:M
      // workout_logs <-> exercises lewat pivot workout_details).
      details: unik.map((exercise_id) => ({ exercise_id, ...volume })),
    };
    // Kolom `weight` tidak ada di skema service, jadi beban dicatat di `catatan`
    // (satu-satunya field bebas yang disediakan backend untuk keterangan sesi).
    if (d.weight) body.catatan = `@ ${d.weight}kg`;

    await api.createLog(body);
    state.draft.selectedIds = [];
    await refreshLogs();
    toast(`${unik.length} gerakan tercatat 🔥`);
    await renderLog(app);
  } catch (err) {
    errBox.textContent = err.message || "Gagal menyimpan log";
    toast(err.message || "Gagal menyimpan log", "danger");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "+ LOG EXERCISE";
    }
  }
}

/** Buat exercise custom; kalau nama sudah ada (409), pakai id yang sudah ada. */
async function pastikanExercise(nama) {
  try {
    const res = await api.createExercise({
      nama_latihan: nama,
      kategori: KATEGORI_CUSTOM,
      kalori_per_menit: KALORI_CUSTOM,
      is_premium_only: false,
    });
    return res.data.id;
  } catch (err) {
    if (err.status === 409) {
      const list = await api.listExercises({ keyword: nama });
      const found = list.data.find((e) => e.nama_latihan.toLowerCase() === nama.toLowerCase());
      if (found) return found.id;
    }
    throw err;
  }
}

/* ==================================================================== */
/* 6. HALAMAN AI COACH                                                   */
/* ==================================================================== */

const DURASI_OPSI = [10, 20, 30, 45, 60];
const PERALATAN_OPSI = ["Dumbbell", "Barbell", "Treadmill", "Resistance Band", "Bodyweight", "Kettlebell"];

async function renderCoach(app) {
  const c = state.coach;

  app.innerHTML = `
    <section class="fit-hero">
      <div>
        <p class="fit-mono mb-1">POWERED BY GEMINI</p>
        <h1 class="fit-display fit-page-title">AI COACH</h1>
      </div>
      <span class="fit-badge-lime">${state.user.is_premium ? "PREMIUM ✦" : "FREE"}</span>
    </section>

    <div class="fit-card">
      <div class="fit-mono form-label">AVAILABLE TIME</div>
      <div class="d-flex flex-wrap gap-2 mb-3">
        ${DURASI_OPSI.map((m) => `<button class="btn fit-chip" data-durasi="${m}">${m}m</button>`).join("")}
      </div>

      <div class="fit-mono form-label">EQUIPMENT AVAILABLE</div>
      <div class="d-flex flex-wrap gap-2 mb-3">
        ${PERALATAN_OPSI.map((p) => `<button class="btn fit-chip" data-peralatan="${p}">${esc(p)}</button>`).join("")}
      </div>

      <div class="fit-mono form-label">TELL AI MORE (OPTIONAL)</div>
      <textarea class="form-control fit-input" id="coachNote" maxlength="500"
        placeholder="e.g. I want to focus on glutes and legs today, intermediate level…">${esc(c.note)}</textarea>

      <button class="btn fit-btn-primary mt-3" id="btnGenerate">✦ GENERATE WORKOUT PLAN</button>
    </div>

    <div id="coachResult" class="mt-4">${c.result ? templateHasilCoach(c.result) : ""}</div>`;

  $$("[data-durasi]").forEach((b) => b.classList.toggle("active", Number(b.dataset.durasi) === c.durasi));
  $$("[data-peralatan]").forEach((b) => b.classList.toggle("active", c.peralatan.includes(b.dataset.peralatan)));

  $$("[data-durasi]").forEach((b) =>
    b.addEventListener("click", () => {
      c.durasi = Number(b.dataset.durasi);
      $$("[data-durasi]").forEach((x) => x.classList.toggle("active", x === b));
    })
  );
  $$("[data-peralatan]").forEach((b) =>
    b.addEventListener("click", () => {
      const p = b.dataset.peralatan;
      c.peralatan = c.peralatan.includes(p) ? c.peralatan.filter((x) => x !== p) : [...c.peralatan, p];
      b.classList.toggle("active");
    })
  );
  $("#coachNote").addEventListener("input", (e) => (c.note = e.target.value));
  $("#btnGenerate").addEventListener("click", () => generatePlan(app));

  bindLogGerakan(app);
}

/** Bangun payload: `kondisi` wajib (min 5 karakter) walau user tidak menulis catatan. */
function payloadCoach() {
  const c = state.coach;
  const equipment = c.peralatan.join(", ");
  const kondisi =
    c.note.trim() ||
    `Workout singkat ${c.durasi} menit${equipment ? ` dengan peralatan ${equipment}` : ""} untuk semua level.`;
  return {
    user_id: state.user.id,
    kondisi,
    durasi_menit: c.durasi,
    peralatan: equipment.slice(0, 120) || undefined,
  };
}

async function generatePlan(app) {
  const btn = $("#btnGenerate");
  const box = $("#coachResult");
  btn.disabled = true;
  btn.textContent = "MENGHUBUNGAI AI…";
  box.innerHTML = spinnerBlock("Coach menyusun program…");

  try {
    const res = await api.generate(payloadCoach());
    state.coach.result = res.data;
    state.coach.error = null;
    box.innerHTML = templateHasilCoach(res.data);
  } catch (err) {
    // 502/504 dari service sudah membawa fallback gerakan dari DB (lihat
    // recommendationController) — tampilkan pesan + fallback, jangan crash.
    const fallback = err.payload?.data?.gerakan ? err.payload.data : null;
    state.coach.error = err.message;
    box.innerHTML = `
      <div class="fit-card" style="border-color:var(--fit-orange)">
        <p class="fit-mono mb-1" style="color:var(--fit-orange)">LAYANAN AI BERMASALAH</p>
        <p class="mb-3" style="font-size:.9rem">${esc(err.message)}</p>
        ${fallback ? templateHasilCoach(fallback) : `<p class="fit-mono mb-0">Coba lagi beberapa saat.</p>`}
      </div>`;
    toast(err.message, "danger");
  } finally {
    btn.disabled = false;
    btn.textContent = "✦ GENERATE WORKOUT PLAN";
    bindLogGerakan(app);
  }
}

function templateHasilCoach(data) {
  const gerakan = data.gerakan || data.gerakan_katalog_lokal || [];
  const sumberLabel = {
    gemini_ai: "GEMINI AI",
    template_database: "TEMPLATE DATABASE",
    fallback_database: "FALLBACK DATABASE",
  }[data.sumber];

  return `
    ${
      data.arahan_ai
        ? `<div class="fit-card mb-3">
             <p class="fit-mono mb-2">ARAHAN AI (${esc(sumberLabel || data.tipe_akun || "")})</p>
             <div class="fit-ai-text">${esc(data.arahan_ai)}</div>
           </div>`
        : ""
    }
    ${data.pesan ? `<div class="fit-card mb-3"><p class="mb-0" style="font-size:.88rem">${esc(data.pesan)}</p></div>` : ""}

    <h2 class="fit-section-title">Gerakan yang Disarankan</h2>
    ${gerakan
      .map(
        (g) => `<div class="fit-list-item">
          <span class="ex-emoji" style="font-size:1.2rem">${exEmoji(g.gerakan)}</span>
          <div class="flex-fill">
            <div class="fit-display" style="font-size:.82rem">${esc(g.gerakan)}</div>
            <div class="fit-mono">${esc(g.kelompok_otot)} · ${num(g.estimasi_kalori_per_menit)} kcal/menit</div>
          </div>
          <button class="btn fit-chip" data-log-exercise="${g.exercise_id}" data-log-name="${esc(g.gerakan)}">+ LOG</button>
        </div>`
      )
      .join("")}`;
}

/** Tombol + LOG pada hasil rekomendasi -> catat 3 set x 12 reps hari ini. */
function bindLogGerakan(root) {
  $$("[data-log-exercise]", root).forEach((b) =>
    b.addEventListener("click", async () => {
      b.disabled = true;
      try {
        await api.createLog({
          user_id: state.user.id,
          tanggal: todayISO(),
          catatan: "dari rekomendasi AI coach",
          details: [{ exercise_id: Number(b.dataset.logExercise), set: 3, repetition: 12 }],
        });
        await refreshLogs();
        b.textContent = "✓ LOGGED";
        toast(`${b.dataset.logName} tercatat ✅`);
      } catch (err) {
        b.disabled = false;
        toast(err.message, "danger");
      }
    })
  );
}

/* ==================================================================== */
/* 7. HALAMAN PROGRESS                                                   */
/* ==================================================================== */

async function renderProgress(app) {
  const history = state.history;
  const [stat, logList] = await Promise.all([
    api.getStatistik(state.user.id, { mulai: history.from, sampai: history.to }),
    api.listUserLogs(state.user.id, {
      limit: 20,
      offset: history.offset,
      sort: "tanggal",
      order: "desc",
      mulai: history.from,
      sampai: history.to,
      keyword: history.keyword,
      equipment: history.equipment,
      body_part: history.body_part,
    }),
  ]);

  const groups = groupByDate(logList.data);
  for (const g of groups) {
    g.detail = await Promise.all(g.logs.map((l) => logDetail(l.id)));
    g.exercises = g.detail.flatMap((d) =>
      (d.exercises || []).map((e) => ({
        nama: e.nama_latihan,
        label: detailLabel(e),
        kcal: num(e.WorkoutDetail?.kalori_terbakar),
      }))
    );
    g.kcal = g.logs.reduce((s, l) => s + num(l.total_kalori), 0);
  }

  const frekuensi = new Map();
  groups.forEach((g) => g.exercises.forEach((e) => frekuensi.set(e.nama, (frekuensi.get(e.nama) || 0) + 1)));
  const mostLogged = [...frekuensi.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxCount = mostLogged.length ? mostLogged[0][1] : 1;

  const today = todayISO();

  app.innerHTML = `
    <section class="fit-hero">
      <div>
        <p class="fit-mono mb-1">YOUR JOURNEY</p>
        <h1 class="fit-display fit-page-title">PROGRESS</h1>
      </div>
    </section>

    <div class="row g-2">
      <div class="col-6">
        <div class="fit-card fit-card-accent">
          <p class="fit-mono mb-1">TOTAL SESSIONS</p>
          <div class="fit-stat-value" style="color:var(--fit-lime)">${num(stat.data.total_sesi)}</div>
        </div>
      </div>
      <div class="col-6">
        <div class="fit-card">
          <p class="fit-mono mb-1">TOTAL EXERCISES</p>
          <div class="fit-stat-value">${num(stat.data.gerakan_divariasikan)}</div>
        </div>
      </div>
      <div class="col-6">
        <div class="fit-card">
          <p class="fit-mono mb-1">TOTAL KALORI</p>
          <div class="fit-stat-value">${Math.round(num(stat.data.total_kalori))} <span class="fit-stat-unit">kcal</span></div>
        </div>
      </div>
      <div class="col-6">
        <div class="fit-card">
          <p class="fit-mono mb-1">RATA / SESI</p>
          <div class="fit-stat-value">${Math.round(num(stat.data.rata_kalori_per_sesi))} <span class="fit-stat-unit">kcal</span></div>
        </div>
      </div>
    </div>

    <h2 class="fit-section-title">Most Logged</h2>
    <div class="fit-card">
      ${
        mostLogged.length
          ? mostLogged
              .map(
                ([nama, count]) => `<div class="fit-progress-row">
                  <span class="ex-emoji">${exEmoji(nama)}</span>
                  <span class="name">${esc(nama)}</span>
                  <span class="track"><span style="width:${(count / maxCount) * 100}%"></span></span>
                  <span class="count">${count}×</span>
                </div>`
              )
              .join("")
          : `<p class="fit-mono mb-0">Belum ada data.</p>`
      }
    </div>

    <h2 class="fit-section-title">Session History</h2>
    <form class="fit-card mb-3" id="historyFilters">
      <div class="row g-2">
        <div class="col-6">
          <label class="fit-mono form-label" for="historyFrom">DARI TANGGAL</label>
          <input class="form-control fit-input" id="historyFrom" type="date" value="${esc(history.from)}" />
        </div>
        <div class="col-6">
          <label class="fit-mono form-label" for="historyTo">SAMPAI TANGGAL</label>
          <input class="form-control fit-input" id="historyTo" type="date" value="${esc(history.to)}" />
        </div>
        <div class="col-12">
          <label class="fit-mono form-label" for="historyKeyword">NAMA GERAKAN</label>
          <input class="form-control fit-input" id="historyKeyword" maxlength="100" placeholder="Cari gerakan…" value="${esc(history.keyword)}" />
        </div>
        <div class="col-6">
          <label class="fit-mono form-label" for="historyEquipment">EQUIPMENT</label>
          <select class="form-select fit-input" id="historyEquipment">
            <option value="">Semua equipment</option>
            ${EQUIPMENT_FILTER_OPTIONS.map(
              ([value, label]) => `<option value="${value}" ${history.equipment === value ? "selected" : ""}>${esc(label)}</option>`
            ).join("")}
          </select>
        </div>
        <div class="col-6">
          <label class="fit-mono form-label" for="historyBodyPart">BAGIAN TUBUH</label>
          <select class="form-select fit-input" id="historyBodyPart">
            <option value="">Semua bagian</option>
            ${BODY_PART_FILTER_OPTIONS.map(
              ([value, label]) => `<option value="${esc(value)}" ${history.body_part === value ? "selected" : ""}>${esc(label)}</option>`
            ).join("")}
          </select>
        </div>
      </div>
      <div class="d-flex gap-2 mt-3">
        <button class="btn fit-btn-primary" type="submit">FILTER RIWAYAT</button>
        <button class="btn fit-chip" type="button" id="clearHistoryFilters">RESET</button>
      </div>
    </form>
    ${
      groups.length
        ? groups
            .map(
              (g) => `<div class="fit-card mb-3">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <div class="fit-display" style="font-size:.95rem">${fmtDateUpper(g.date)}</div>
                    <div class="fit-mono">${g.exercises.length} exercises logged · ${Math.round(g.kcal)} kcal</div>
                  </div>
                  ${g.iso === today ? `<span class="fit-badge-lime">TODAY</span>` : ""}
                </div>
                ${g.detail
                  .map((d) => {
                    const catatan = d.catatan && d.catatan.startsWith("@") ? ` ${esc(d.catatan)}` : "";
                    return (d.exercises || [])
                      .map(
                        (e) => `<div class="fit-detail-line">
                          <span>${exEmoji(e.nama_latihan)} <b style="font-size:.78rem">${esc(e.nama_latihan)}</b></span>
                          <span class="fit-mono">${esc(detailLabel(e))}${catatan}</span>
                        </div>`
                      )
                      .join("");
                  })
                  .join("")}
              </div>`
            )
            .join("")
        : `<div class="fit-card text-center py-4"><p class="fit-mono mb-0">${logList.total ? "Tidak ada sesi yang cocok dengan filter." : "Belum ada sesi tersimpan."}</p></div>`
    }

    ${logList.total > 20 ? `<div class="d-flex align-items-center justify-content-between mt-2">
      <button class="btn fit-chip" id="historyPrevious" ${history.offset === 0 ? "disabled" : ""}>← SEBELUMNYA</button>
      <span class="fit-mono">${history.offset + 1}–${Math.min(history.offset + logList.data.length, logList.total)} / ${logList.total}</span>
      <button class="btn fit-chip" id="historyNext" ${history.offset + 20 >= logList.total ? "disabled" : ""}>SELANJUTNYA →</button>
    </div>` : `<p class="fit-mono mt-2">${logList.total} sesi</p>`}

    <a href="#/log" class="btn fit-btn-primary mt-2">+ TAMBAH SESI BARU</a>`;

  $("#historyFilters").addEventListener("submit", (e) => {
    e.preventDefault();
    history.from = $("#historyFrom").value;
    history.to = $("#historyTo").value;
    history.keyword = $("#historyKeyword").value.trim();
    history.equipment = $("#historyEquipment").value;
    history.body_part = $("#historyBodyPart").value;
    history.offset = 0;
    renderRoute();
  });
  $("#clearHistoryFilters").addEventListener("click", () => {
    Object.assign(history, { from: "", to: "", keyword: "", equipment: "", body_part: "", offset: 0 });
    renderRoute();
  });
  $("#historyPrevious")?.addEventListener("click", () => {
    history.offset = Math.max(0, history.offset - 20);
    renderRoute();
  });
  $("#historyNext")?.addEventListener("click", () => {
    history.offset += 20;
    renderRoute();
  });
}

/* ==================================================================== */
/* 8. MODAL PROFIL                                                       */
/* ==================================================================== */

const tutupModalProfil = () => {
  // Pindahkan fokus sebelum modal disembunyikan; Bootstrap menolak aria-hidden
  // pada elemen yang masih berisi elemen fokus (warning konsol).
  document.activeElement?.blur?.();
  bootstrap.Modal.getOrCreateInstance($("#modalProfile")).hide();
};

function bukaModalProfil() {
  const u = state.user;
  if (!u) return;
  $("#pfUsername").value = u.username || "";
  $("#pfUmur").value = u.umur ?? "";
  $("#pfTinggi").value = u.tinggi_badan ?? "";
  $("#pfBerat").value = u.berat_badan ?? "";
  $("#pfEmail").textContent = `${u.email} · ${u.is_premium ? "PREMIUM" : "FREE"}`;
  $("#pfError").textContent = "";
  $$("[data-gender]").forEach((b) => b.classList.toggle("active", b.dataset.gender === u.gender));
}

function bindProfile() {
  $("#btnProfile").addEventListener("click", bukaModalProfil);

  $$("[data-gender]").forEach((b) =>
    b.addEventListener("click", () => {
      $$("[data-gender]").forEach((x) => x.classList.toggle("active", x === b));
      b.dataset.selected = "1";
    })
  );

  $("#formProfile").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.user) return;
    $("#pfError").textContent = "";

    const genderAktif = $$("[data-gender]").find((b) => b.classList.contains("active"));
    const angkaAtauNull = (v) => (v === "" ? null : num(v, null));

    const body = {
      username: $("#pfUsername").value.trim(),
      umur: angkaAtauNull($("#pfUmur").value),
      gender: genderAktif ? genderAktif.dataset.gender : null,
      berat_badan: angkaAtauNull($("#pfBerat").value),
      tinggi_badan: angkaAtauNull($("#pfTinggi").value),
    };

    try {
      const res = await api.updateUser(state.user.id, body);
      state.user = { ...state.user, ...res.data };
      updateTopbar();
      tutupModalProfil();
      toast("Profil diperbarui ✅");
      await renderRoute();
    } catch (err) {
      $("#pfError").textContent = pesanValidasi(err);
      toast(err.message, "danger");
    }
  });

  $("#btnLogout").addEventListener("click", () => {
    localStorage.removeItem(LS.user);
    state.user = null;
    state.logs = [];
    tutupModalProfil();
    renderAuth("Anda sudah keluar. Masuk kembali dengan email & password.");
  });
}

/* ==================================================================== */
/* BOOT                                                                  */
/* ==================================================================== */

window.addEventListener("hashchange", () => {
  if (state.user) renderRoute();
});

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(currentTheme());
  bindShell();
  bindProfile();
  bindDemoModal();

  const id = localStorage.getItem(LS.user);
  if (!id) {
    renderAuth();
    return;
  }
  try {
    await loadUser(id);
    await renderRoute();
  } catch (err) {
    localStorage.removeItem(LS.user);
    renderAuth(err.message);
  }
});
