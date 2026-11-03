/**
 * ASET DEMO GERAKAN (GIF / VIDEO) — public/js/demo-assets.js
 * ==========================================================
 *
 * TUJUAN: menyiapkan "rak" aset untuk halaman LOG. UI-nya sudah jadi;
 * nanti tinggal taruh file GIF/MP4 ke folder `public/assets/demo/`.
 *
 * Cara kerja (dua jalur, urutan dicek dari atas):
 *
 *  1. DEMO_ASSETS  -> peta eksplisit, dipakai kalau nama file aset tidak
 *                     mengikuti konvensi slug, atau untuk aset eksternal
 *                     (URL https/... ). Nilainya:
 *                       { src, type?, poster?, credit?, note? }
 *                     `type` boleh dilewati — ditebak dari ekstensi src.
 *                     Key dicocokkan case-insensitive terhadap
 *                     `nama_latihan` ATAU slug nama latihan.
 *
 *  2. Konvensi slug -> kalau tidak ada di peta, UI mencoba memuat
 *                     /assets/demo/<slug>.<ext> sesuai DEMO_EXT_URUT.
 *                     File yang belum ada gagal dimuat dan tampilan otomatis
 *                     jatuh ke placeholder (tidak ada error ke user).
 *
 *  Contoh: "Dumbbell Curl" -> /assets/demo/dumbbell-curl.gif
 *
 * 3. Kalau dua-duanya kosong -> placeholder berisi emoji + petunjuk lokasi
 *    file, jadi area preview tetap rapi dan ukurannya tidak berubah.
 */

const DEMO_FOLDER = "/assets/demo";

/** Urutan ekstensi yang dicoba. `.gif` duluan karena paling ringan dipakai. */
const DEMO_EXT_URUT = ["gif", "mp4", "webm"];

const DEMO_VIDEO_EXT = ["mp4", "webm", "mov", "m4v"];

/**
 * Peta eksplisit. ISI DI SINI SAAT ASET DITERIMA.
 * (Contoh _sample aktif dipakai sebagai bukti jalur render bekerja.)
 */
const DEMO_ASSETS = {
  squat: {
    src: `${DEMO_FOLDER}/_sample-squat.svg`,
    note: "Contoh sementara (animasi placeholder). Ganti dengan GIF/MP4 gerakan squat yang sebenarnya.",
  },

  // Contoh entri yang bisa langsung ditiru:
  // "dumbbell curl": { src: `${DEMO_FOLDER}/dumbbell-curl.gif` },
  // "treadmill":     { src: `${DEMO_FOLDER}/treadmill.mp4`, poster: `${DEMO_FOLDER}/treadmill.jpg`, credit: "Sumber: ..." },
  // "plank":         { src: "https://example.com/plank.gif", credit: "URL eksternal juga boleh" },
};

/** "Dumbbell Curl!" -> "dumbbell-curl" */
const demoSlug = (nama) =>
  String(nama || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const adalahVideo = (src) =>
  DEMO_VIDEO_EXT.includes(String(src).split("?")[0].split(".").pop().toLowerCase());

/**
 * Cari aset demo untuk satu gerakan.
 * @returns {{src:string, type:"gif"|"video", poster?:string, credit?:string, note?:string}|null}
 */
function resolveDemoAsset(namaLatihan) {
  const nama = String(namaLatihan || "").trim().toLowerCase();
  const slug = demoSlug(namaLatihan);
  if (!slug) return null;

  const entri = DEMO_ASSETS[nama] || DEMO_ASSETS[slug] || null;
  if (entri && entri.src) {
    return { ...entri, type: entri.type || (adalahVideo(entri.src) ? "video" : "gif") };
  }

  // Jalur konvensi: tidak perlu menulis kode, cukup taruh file di folder demo.
  const kandidat = DEMO_EXT_URUT.map((ext) => `${DEMO_FOLDER}/${slug}.${ext}`);
  return {
    src: kandidat[0],
    kandidatSrc: kandidat, // dipakai UI untuk mencoba ekstensi lain saat onerror
    type: adalahVideo(kandidat[0]) ? "video" : "gif",
    dariKonvensi: true,
  };
}

/**
 * Cek keberadaan file aset lewat HEAD request. Hasilnya disimpan di cache
 * supaya satu gerakan tidak diperiksa berkali-kali (baris 404 di console
 * tetap muncul satu kali per file yang belum ada — itu bukan error aplikasi).
 */
const demoProbeCache = new Map();

async function demoTersedia(url) {
  if (demoProbeCache.has(url)) return demoProbeCache.get(url);
  let ok = false;
  try {
    ok = (await fetch(url, { method: "HEAD", cache: "no-store" })).ok;
  } catch {
    ok = false; // offline / server mati: anggap aset tidak ada
  }
  demoProbeCache.set(url, ok);
  return ok;
}

/** Ambil src pertama yang benar-benar ada dari daftar kandidat ekstensi. */
async function pilihAsetDemoTersedia(kandidat = []) {
  for (const src of kandidat) {
    if (await demoTersedia(src)) return src;
  }
  return null;
}

/**
 * Isi rak/modal demo untuk satu gerakan (async: probe file dulu).
 * @returns {Promise<string>} markup HTML media atau placeholder
 */
async function isiDemo(namaLatihan, { besar = false } = {}) {
  const aset = resolveDemoAsset(namaLatihan);
  if (!aset) return templateDemoPlaceholder(namaLatihan);

  let src = aset.src;
  if (aset.dariKonvensi) {
    const tersedia = await pilihAsetDemoTersedia(aset.kandidatSrc);
    if (!tersedia) return templateDemoPlaceholder(namaLatihan);
    src = tersedia;
  }
  return templateDemoMedia({ ...aset, src, type: adalahVideo(src) ? "video" : "gif" }, namaLatihan, {
    besar,
  });
}

/** Markup media (img/gif atau video) + placeholder cadangan. */
function templateDemoMedia(aset, namaLatihan, { besar = false } = {}) {
  const emoji = typeof exEmoji === "function" ? exEmoji(namaLatihan) : "🏋️";
  const slug = demoSlug(namaLatihan);

  if (!aset) {
    return templateDemoPlaceholder(namaLatihan, emoji, slug);
  }

  const sumber = aset.poster ? `poster="${esc(aset.poster)}"` : "";
  const media =
    aset.type === "video"
      ? `<video class="fit-demo-media" src="${esc(aset.src)}" ${sumber} controls autoplay muted loop playsinline preload="metadata"></video>`
      : `<img class="fit-demo-media" src="${esc(aset.src)}" alt="Contoh gerakan ${esc(namaLatihan)}" loading="lazy" decoding="async" />`;

  return `
    <div class="fit-demo-media-wrap ${besar ? "is-large" : ""}"
         data-demo-slug="${esc(slug)}"
         data-demo-nama="${esc(namaLatihan)}"
         data-kandidat="${esc((aset.kandidatSrc || []).join(","))}">
      ${media}
      <span class="fit-demo-type">${aset.type === "video" ? "▶ VIDEO" : "◉ GIF"}</span>
      ${
        aset.note || aset.credit
          ? `<div class="fit-demo-note">${esc(aset.note || aset.credit)}</div>`
          : ""
      }
    </div>`;
}

/** Ditampilkan kalau file belum ada / gagal dimuat. */
function templateDemoPlaceholder(namaLatihan, emoji, slug) {
  const nama = slug === undefined ? demoSlug(namaLatihan) : slug;
  const ikon = emoji || (typeof exEmoji === "function" ? exEmoji(namaLatihan) : "🏋️");
  const target = nama ? `${nama}.gif` : "<nama-gerakan>.gif";
  return `
    <div class="fit-demo-media-wrap is-empty" data-demo-slug="${esc(nama)}" data-demo-nama="${esc(namaLatihan)}">
      <div class="fit-demo-empty">
        <span class="fit-demo-empty-emoji">${ikon}</span>
        <p class="fit-mono mb-1">CONTOH GERAKAN BELUM ADA</p>
        <p class="fit-demo-hint mb-0">
          Taruh file di <code>public/assets/demo/${esc(target)}</code>
          <br>atau daftarkan di <code>js/demo-assets.js</code>
        </p>
      </div>
    </div>`;
}
