/**
 * ROUTES PAYMENT — /api/v1/payments (integrasi Midtrans)
 * ======================================================
 * Hanya "URL mana memanggil fungsi mana" (CONTEXT.md §1). Tidak ada if/logika.
 * Kedua jalur khusus POST; method lain ditangkap methodNotAllowed -> 405.
 */
const express = require("express");
const router = express.Router();

const methodNotAllowed = require("../middlewares/methodNotAllowed");
const { validate, schemas } = require("../middlewares/validation");

const {
  createTransaction,
  midtransNotification,
} = require("../controllers/paymentController");

// "/transaction" -> klien minta token Snap untuk mulai membayar.
router
  .route("/transaction")
  .post(validate(schemas.paymentCreateSchema), createTransaction)
  .all(methodNotAllowed("POST"));

// "/notification" -> webhook server-to-server dari Midtrans (TANPA validasi Joi;
// keasliannya dijaga lewat verifikasi signature_key di controller).
router
  .route("/notification")
  .post(midtransNotification)
  .all(methodNotAllowed("POST"));

module.exports = router;
