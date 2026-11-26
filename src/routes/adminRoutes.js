const express = require("express");
const router = express.Router();
const methodNotAllowed = require("../middlewares/methodNotAllowed");
const { validate, schemas } = require("../middlewares/validation");
const { requireAuth, requireAdmin, logoutAllSessions, listRefreshSessions } = require("../middlewares/auth");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const {
  dashboard,
  listEquipments,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  listPricingPlans,
  createPricingPlan,
  updatePricingPlan,
  deletePricingPlan,
  listUsers,
  updateUserAdmin,
  listExercisesAdmin,
  createExerciseAdmin,
  updateExerciseAdmin,
  deleteExerciseAdmin,
  listExerciseMedia,
  createExerciseMedia,
  deleteExerciseMedia,
  deleteUserAdmin,
  restoreUserAdmin,
  listUserPaymentsAdmin,
  listUserWorkoutLogsAdmin,
} = require("../controllers/adminController");

const uploadDir = path.join(process.cwd(), "public", "uploads", "exercises");
fs.mkdirSync(uploadDir, { recursive: true });

const MIME_EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

const MIME_EXTENSIONS_ALLOWED = new Set([...Object.values(MIME_EXTENSIONS), ".jpeg"]);

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const mimeExtension = MIME_EXTENSIONS[file.mimetype];
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${mimeExtension}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const originalExtension = path.extname(file.originalname).toLowerCase();
    const mimeExtension = MIME_EXTENSIONS[file.mimetype];
    const mimeAllowed = Boolean(mimeExtension);
    const extensionAllowed = MIME_EXTENSIONS_ALLOWED.has(originalExtension);
    const jpegCompatible = file.mimetype === "image/jpeg" && [".jpg", ".jpeg"].includes(originalExtension);
    const pairMismatch = mimeAllowed && mimeExtension !== originalExtension && !jpegCompatible;
    if (!mimeAllowed || !extensionAllowed || pairMismatch) {
      const error = new Error("Tipe file media tidak didukung");
      error.status = 400;
      error.expose = true;
      return cb(error);
    }
    cb(null, true);
  },
});

router.use(requireAuth, requireAdmin);

router.route("/dashboard").get(dashboard).all(methodNotAllowed("GET"));

router
  .route("/users")
  .get(listUsers)
  .all(methodNotAllowed("GET"));

router
  .route("/users/:id")
  .patch(validate(schemas.adminUserUpdateSchema), updateUserAdmin)
  .delete(deleteUserAdmin)
  .all(methodNotAllowed("PATCH", "DELETE"));

router
  .route("/users/:id/restore")
  .post(restoreUserAdmin)
  .all(methodNotAllowed("POST"));

router
  .route("/users/:id/payments")
  .get(listUserPaymentsAdmin)
  .all(methodNotAllowed("GET"));

router
  .route("/users/:id/workout-logs")
  .get(listUserWorkoutLogsAdmin)
  .all(methodNotAllowed("GET"));

router
  .route("/equipments")
  .get(listEquipments)
  .post(validate(schemas.equipmentCreateSchema), createEquipment)
  .all(methodNotAllowed("GET", "POST"));

router
  .route("/equipments/:id")
  .patch(validate(schemas.equipmentUpdateSchema), updateEquipment)
  .delete(deleteEquipment)
  .all(methodNotAllowed("PATCH", "DELETE"));

router
  .route("/exercises")
  .get(listExercisesAdmin)
  .post(validate(schemas.adminExerciseCreateSchema), createExerciseAdmin)
  .all(methodNotAllowed("GET", "POST"));

router
  .route("/exercises/:id")
  .patch(validate(schemas.adminExerciseUpdateSchema), updateExerciseAdmin)
  .delete(deleteExerciseAdmin)
  .all(methodNotAllowed("PATCH", "DELETE"));

router
  .route("/exercises/:id/media")
  .get(listExerciseMedia)
  .post(upload.single("file"), validate(schemas.exerciseMediaCreateSchema), createExerciseMedia)
  .all(methodNotAllowed("GET", "POST"));

router
  .route("/exercises/:id/media/:mediaId")
  .delete(deleteExerciseMedia)
  .all(methodNotAllowed("DELETE"));

router
  .route("/pricing-plans")
  .get(listPricingPlans)
  .post(validate(schemas.pricingPlanCreateSchema), createPricingPlan)
  .all(methodNotAllowed("GET", "POST"));

router
  .route("/pricing-plans/:id")
  .patch(validate(schemas.pricingPlanUpdateSchema), updatePricingPlan)
  .delete(deletePricingPlan)
  .all(methodNotAllowed("PATCH", "DELETE"));

router
  .route("/users/:id/sessions")
  .get(listRefreshSessions)
  .post(logoutAllSessions)
  .all(methodNotAllowed("GET", "POST"));

module.exports = router;
