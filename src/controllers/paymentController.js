/**
 * CONTROLLER PAYMENT — Integrasi Midtrans (Snap API) — UTS SOA
 * ============================================================
 *
 * Dua tugas, memisahkan "ajak bayar" (klien) dari "nyatakan sudah bayar"
 * (server). Prinsip keamanan yang DIPEGANG kuat di sini:
 *
 *   1. createTransaction  : melayani SPA/Mobile. Membangun order_id unik +
 *      memanggil Midtrans lewat SERVER KEY untuk mendapat `snap_token` +
 *      `redirect_url`. Nominal/item TIDAK dibaca dari body (anti rekayasa harga).
 *
 *   2. midtransNotification: WEBHOOK server-to-server. Status premium user
 *      HANYA boleh berubah kalau notifikasi ini lolos verifikasi `signature_key`
 *      (SHA512(order_id + status_code + gross_amount + SERVER_KEY)). Redirect
 *     /snapshot di sisi klien TIDAK PERNAH dipercaya untuk menyetel premium.
 *
 * Aturan response sama seperti controller lain: format { status, message, data },
 * tidak ada stack trace/rahasia yang keluar, async/atan tanpa pembungkus (Express 5
 * meneruskan error async ke errorHandler secara otomatis).
 */
const crypto = require("crypto");
const midtransClient = require("midtrans-client");
const { User } = require("../models");

/* ------------------------------------------------------------------ */
/* Konfigurasi — SEMUA dari .env, tidak ada rahasia di kode.           */
/* ------------------------------------------------------------------ */
const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
const IS_PRODUCTION =
  String(process.env.MIDTRANS_IS_PRODUCTION).toLowerCase() === "true";
// Nominal (Rupiah) untuk upgrade premium. Sama dipakai saat create & verifikasi.
const PREMIUM_AMOUNT = Number(process.env.PREMIUM_AMOUNT) || 25000;

// Satu instance Snap dibuat sekali, dipakai ulang (stateless & aman).
let _snap = null;
const getSnap = () => {
  if (!_snap) {
    _snap = new midtransClient.Snap({
      isProduction: IS_PRODUCTION,
      serverKey: MIDTRANS_SERVER_KEY,
    });
  }
  return _snap;
};

// Pola order_id kita: PREM-<user_id>-<timestamp_ms>.
const ORDER_ID_RE = /^PREM-(\d+)-\d+$/;

// Status yang berarti "uang masuk" dan boleh menaikkan premium.
const STATUS_LUNAS = ["settlement", "capture"];

/**
 * Hitung signature_key versi Midtrans dan bandingkan dengan yang dikirim,
 * memakai perbandingan waktu-konstan (anti timing attack).
 */
const signatureValid = ({ order_id, status_code, gross_amount, signature_key }) => {
  if (!order_id || !status_code || !gross_amount || !signature_key) return false;
  const expected = crypto
    .createHash("sha512")
    .update(`${order_id}${status_code}${gross_amount}${MIDTRANS_SERVER_KEY}`)
    .digest("hex");
  if (
    typeof signature_key !== "string" ||
    signature_key.length !== expected.length
  ) {
    return false;
  }
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature_key, "hex")
  );
};

/* ================================================================== */
/* POST /api/v1/payments/transaction                                   */
/* ================================================================== */
const createTransaction = async (req, res) => {
  const { user_id } = req.validated; // sudah dibersihkan Joi; BUKAN req.body mentah

  if (!MIDTRANS_SERVER_KEY) {
    console.error("[MIDTRANS] MIDTRANS_SERVER_KEY belum diisi di .env");
    return res.status(503).json({
      status: "error",
      message: "Layanan pembayaran belum dikonfigurasi (server key kosong)",
    });
  }

  // 1) user harus ada.
  const user = await User.findByPk(user_id);
  if (!user) {
    return res
      .status(404)
      .json({ status: "fail", message: `User dengan id ${user_id} tidak ditemukan` });
  }

  // 2) aturan bisnis: user yang sudah premium tidak perlu bayar lagi.
  if (user.is_premium) {
    return res
      .status(409)
      .json({ status: "fail", message: "User ini sudah berstatus Premium" });
  }

  // 3) bangun order_id unik dari sisi server (user_id + waktu).
  const order_id = `PREM-${user.id}-${Date.now()}`;

  // 4) panggil Midtrans (SERVER KEY) untuk membuat transaksi Snap.
  try {
    const tx = await getSnap().createTransaction({
      transaction_details: {
        order_id,
        gross_amount: PREMIUM_AMOUNT,
      },
      item_details: [
        {
          id: "premium-subscription",
          price: PREMIUM_AMOUNT,
          quantity: 1,
          name: "Upgrade Premium — Rekomendasi Latihan AI",
        },
      ],
      customer_details: {
        first_name: user.nama,
        email: user.email,
      },
    });

    // 5) kembalikan hanya yang dibutuhkan klien. Response Midtrans TIDAK
    //    diteruskan apa adanya — field dipilih & dinormalisasi (pola butir 5).
    return res.status(201).json({
      status: "success",
      message: "Transaksi premium berhasil dibuat",
      data: {
        order_id,
        snap_token: tx.token,
        redirect_url: tx.redirect_url,
      },
    });
  } catch (err) {
    // Detail upstream hanya ke log; klien dapat pesan aman + status 502.
    console.error(
      "[MIDTRANS] createTransaction gagal:",
      err?.message,
      err?.statusCode || ""
    );
    return res.status(502).json({
      status: "error",
      message: "Layanan pembayaran sedang tidak dapat dihubungi",
    });
  }
};

/* ================================================================== */
/* POST /api/v1/payments/notification   (WEBHOOK Midtrans)             */
/* ================================================================== */
const midtransNotification = async (req, res) => {
  const body = req.body || {};
  const {
    order_id,
    transaction_status,
    gross_amount,
    status_code,
    signature_key,
    fraud_status,
  } = body;

  // 1) verifikasi keaslian: hanya Midtrans yang tahu SERVER_KEY.
  if (!signatureValid(body)) {
    console.warn("[MIDTRANS] notifikasi ditolak: signature tidak valid", {
      order_id,
    });
    return res
      .status(403)
      .json({ status: "fail", message: "Verifikasi signature notifikasi gagal" });
  }

  // 2) cocokkan nominal agar tidak bisa dimanipulasi (uang palsu).
  if (Number(gross_amount) !== PREMIUM_AMOUNT) {
    console.warn("[MIDTRANS] gross_amount tidak sesuai:", gross_amount);
    return res.status(400).json({
      status: "fail",
      message: "Nominal transaksi tidak sesuai paket premium",
    });
  }

  // 3) ekstrak user_id dari order_id berpola PREM-<user_id>-<ts>.
  const match = ORDER_ID_RE.exec(order_id || "");
  if (!match) {
    return res.status(400).json({
      status: "fail",
      message: `order_id tidak dikenali: ${order_id}`,
    });
  }
  const user_id = Number(match[1]);

  // 4) bukan status lunas -> akui (200) tanpa mengubah apa pun.
  //    Ini normal: Midtrans mengirim beberapa status (pending/expired/denied).
  if (!STATUS_LUNAS.includes(transaction_status)) {
    return res.status(200).json({
      status: "success",
      message: `Status '${transaction_status}' diterima, tidak ada perubahan premium`,
    });
  }

  // 5) capture kartu kredit/one-klik: tunggu peninjauan fraud sebelum memberi akses.
  if (transaction_status === "capture") {
    if (fraud_status && fraud_status !== "accept") {
      return res.status(200).json({
        status: "success",
        message: `Capture menunggu verifikasi fraud (${fraud_status}), premium belum diaktifkan`,
      });
    }
  }

  // 6) user harus masih ada.
  const user = await User.findByPk(user_id);
  if (!user) {
    return res
      .status(404)
      .json({ status: "fail", message: `User dengan id ${user_id} tidak ditemukan` });
  }

  // 7) naikkan premium. Idempoten: dipanggil ulang (retry Midtrans) tetap aman.
  if (!user.is_premium) {
    await user.update({ is_premium: true });
    console.log(`[MIDTRANS] user ${user.id} -> PREMIUM (${transaction_status}, ${order_id})`);
  }

  return res.status(200).json({
    status: "success",
    message: "Pembayaran diterima, akun Premium diaktifkan",
    data: { user_id: user.id, is_premium: true, order_id, transaction_status },
  });
};

module.exports = { createTransaction, midtransNotification };
