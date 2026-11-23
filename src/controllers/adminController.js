const { Op } = require("sequelize");
const {
  User,
  Exercise,
  WorkoutLog,
  Equipment,
  PricingPlan,
  PaymentTransaction,
  AdminActionLog,
} = require("../models");

const audit = async (req, action, entityType, entityId, beforeData, afterData) =>
  AdminActionLog.create({
    admin_id: req.auth.user_id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    before_data: beforeData || null,
    after_data: afterData || null,
    ip_address: req.ip,
  });

const dashboard = async (req, res) => {
  const [totalUsers, freeUsers, premiumUsers, adminUsers, totalExercises, totalEquipments, totalLogs, paidTransactions] =
    await Promise.all([
      User.count(),
      User.count({ where: { is_premium: false } }),
      User.count({ where: { is_premium: true } }),
      User.count({ where: { role: "admin" } }),
      Exercise.count(),
      Equipment.count(),
      WorkoutLog.count(),
      PaymentTransaction.count({ where: { status: { [Op.in]: ["settlement", "capture"] } } }),
    ]);

  return res.status(200).json({
    status: "success",
    data: {
      total_users: totalUsers,
      free_users: freeUsers,
      premium_users: premiumUsers,
      admin_users: adminUsers,
      total_exercises: totalExercises,
      total_equipments: totalEquipments,
      total_workout_logs: totalLogs,
      paid_transactions: paidTransactions,
    },
  });
};

const listEquipments = async (req, res) => {
  const equipments = await Equipment.findAll({ order: [["sort_order", "ASC"], ["name", "ASC"]] });
  return res.status(200).json({ status: "success", data: equipments });
};

const createEquipment = async (req, res) => {
  const data = req.validated;
  if (!data.slug) {
    data.slug = data.name;
  }
  const duplicate = await Equipment.findOne({
    where: { [Op.or]: [{ name: data.name }, { slug: data.slug }] },
  });
  if (duplicate) {
    return res.status(409).json({ status: "fail", message: "Nama atau slug equipment sudah digunakan" });
  }
  const equipment = await Equipment.create(data);
  await audit(req, "create", "equipment", equipment.id, null, equipment.get({ plain: true }));
  return res.status(201).location(`/api/v1/admin/equipments/${equipment.id}`).json({
    status: "success",
    message: "Equipment berhasil ditambahkan",
    data: equipment,
  });
};

const updateEquipment = async (req, res) => {
  const equipment = await Equipment.findByPk(req.params.id);
  if (!equipment) {
    return res.status(404).json({ status: "fail", message: "Equipment tidak ditemukan" });
  }
  const before = equipment.get({ plain: true });
  await equipment.update(req.validated);
  await audit(req, "update", "equipment", equipment.id, before, equipment.get({ plain: true }));
  return res.status(200).json({ status: "success", message: "Equipment berhasil diperbarui", data: equipment });
};

const deleteEquipment = async (req, res) => {
  const equipment = await Equipment.findByPk(req.params.id);
  if (!equipment) {
    return res.status(404).json({ status: "fail", message: "Equipment tidak ditemukan" });
  }
  const exerciseCount = await Exercise.count({ where: { equipment: equipment.slug } });
  if (exerciseCount > 0) {
    return res.status(409).json({
      status: "fail",
      message: `Equipment masih dipakai oleh ${exerciseCount} exercise dan tidak dapat dihapus permanen`,
    });
  }
  await equipment.destroy();
  await audit(req, "delete", "equipment", equipment.id, equipment.get({ plain: true }), null);
  return res.status(200).json({ status: "success", message: "Equipment berhasil dinonaktifkan" });
};

const listPricingPlans = async (req, res) => {
  const plans = await PricingPlan.findAll({ order: [["sort_order", "ASC"], ["id", "ASC"]] });
  return res.status(200).json({ status: "success", data: plans });
};

const createPricingPlan = async (req, res) => {
  const duplicate = await PricingPlan.findOne({ where: { code: req.validated.code } });
  if (duplicate) {
    return res.status(409).json({ status: "fail", message: "Kode paket sudah digunakan" });
  }
  const plan = await PricingPlan.create(req.validated);
  await audit(req, "create", "pricing_plan", plan.id, null, plan.get({ plain: true }));
  return res.status(201).json({ status: "success", message: "Paket berhasil ditambahkan", data: plan });
};

const updatePricingPlan = async (req, res) => {
  const plan = await PricingPlan.findByPk(req.params.id);
  if (!plan) {
    return res.status(404).json({ status: "fail", message: "Paket tidak ditemukan" });
  }
  const before = plan.get({ plain: true });
  await plan.update(req.validated);
  await audit(req, "update", "pricing_plan", plan.id, before, plan.get({ plain: true }));
  return res.status(200).json({ status: "success", message: "Paket berhasil diperbarui", data: plan });
};

const deletePricingPlan = async (req, res) => {
  const plan = await PricingPlan.findByPk(req.params.id);
  if (!plan) {
    return res.status(404).json({ status: "fail", message: "Paket tidak ditemukan" });
  }
  const activeCount = await PaymentTransaction.count({ where: { plan_id: plan.id } });
  if (activeCount > 0) {
    await plan.update({ is_active: false });
    await audit(req, "deactivate", "pricing_plan", plan.id, null, { is_active: false });
    return res.status(200).json({ status: "success", message: "Paket dinonaktifkan karena sudah memiliki transaksi" });
  }
  await plan.destroy();
  await audit(req, "delete", "pricing_plan", plan.id, plan.get({ plain: true }), null);
  return res.status(200).json({ status: "success", message: "Paket berhasil dihapus" });
};

const listUsers = async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;
  const where = {};
  if (req.query.role) where.role = req.query.role;
  if (req.query.is_premium !== undefined) where.is_premium = req.query.is_premium === "true";
  if (req.query.keyword) {
    const k = `%${String(req.query.keyword).trim().toLowerCase()}%`;
    where[Op.or] = [
      { nama: { [Op.like]: k } },
      { username: { [Op.like]: k } },
      { email: { [Op.like]: k } },
    ];
  }
  const { count, rows } = await User.findAndCountAll({ where, limit, offset, order: [["id", "ASC"]] });
  return res.status(200).json({ status: "success", total: count, limit, offset, data: rows });
};

const updateUserAdmin = async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ status: "fail", message: "User tidak ditemukan" });
  if (user.role === "admin" && req.validated.role === "user") {
    const adminCount = await User.count({ where: { role: "admin" } });
    if (adminCount <= 1) {
      return res.status(409).json({ status: "fail", message: "Tidak boleh mencabut role admin terakhir" });
    }
  }
  const before = user.get({ plain: true });
  await user.update(req.validated);
  await audit(req, "update", "user", user.id, before, user.get({ plain: true }));
  return res.status(200).json({ status: "success", message: "User berhasil diperbarui", data: user });
};

module.exports = {
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
};
