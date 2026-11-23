const express = require("express");
const router = express.Router();
const methodNotAllowed = require("../middlewares/methodNotAllowed");
const { validate, schemas } = require("../middlewares/validation");
const { requireAuth, requireAdmin } = require("../middlewares/auth");
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
} = require("../controllers/adminController");

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
