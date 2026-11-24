const express = require("express");
const router = express.Router();
const methodNotAllowed = require("../middlewares/methodNotAllowed");
const { validate, schemas } = require("../middlewares/validation");
const { requireAuth, requireAdmin } = require("../middlewares/auth");
const multer = require("multer");
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
} = require("../controllers/adminController");

const uploadDir = path.join(process.cwd(), "public", "uploads", "exercises");
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".webm", ".mov"];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
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
  .all(methodNotAllowed("PATCH"));

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

module.exports = router;
