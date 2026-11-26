const { Op } = require("sequelize");
const {
  User,
  Exercise,
  WorkoutLog,
  Equipment,
  PricingPlan,
  PaymentTransaction,
  AdminActionLog,
  ExerciseMedia,
} = require("../models");
const fs = require("fs");
const path = require("path");

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
  const includeDeleted = req.query.include_deleted === "true";
  const includeDeletedOnly = req.query.deleted_only === "true";
  if (includeDeletedOnly) where.deleted_at = { [Op.ne]: null };
  const { count, rows } = await User.findAndCountAll({
    where,
    limit,
    offset,
    order: [["id", "ASC"]],
    paranoid: includeDeleted || includeDeletedOnly,
  });
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

const deleteUserAdmin = async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ status: "fail", message: "User tidak ditemukan" });
  if (user.role === "admin") {
    const adminCount = await User.count({ where: { role: "admin" } });
    if (adminCount <= 1) return res.status(409).json({ status: "fail", message: "Tidak boleh menghapus administrator terakhir" });
  }
  const logCount = await WorkoutLog.count({ where: { user_id: user.id } });
  if (logCount > 0) return res.status(409).json({ status: "fail", message: `User masih memiliki ${logCount} workout log aktif` });
  const before = user.get({ plain: true });
  await user.destroy();
  await audit(req, "soft_delete", "user", user.id, before, { deleted_at: new Date() });
  return res.status(200).json({ status: "success", message: "User berhasil di-soft delete" });
};

const restoreUserAdmin = async (req, res) => {
  const user = await User.findByPk(req.params.id, { paranoid: false });
  if (!user) return res.status(404).json({ status: "fail", message: "User tidak ditemukan" });
  if (!user.deleted_at) return res.status(409).json({ status: "fail", message: "User tidak dalam status terhapus" });
  const deletedAt = user.deleted_at;
  await user.restore();
  await audit(req, "restore", "user", user.id, { deleted_at: deletedAt }, null);
  return res.status(200).json({ status: "success", message: "User berhasil dipulihkan", data: user });
};

const listExercisesAdmin = async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 100);
  const offset = Number(req.query.offset) || 0;
  const where = {};
  if (req.query.keyword) where.nama_latihan = { [Op.like]: `%${String(req.query.keyword).trim()}%` };
  if (req.query.category) where.kategori = req.query.category;
  if (req.query.equipment) where.equipment = req.query.equipment;
  const { count, rows } = await Exercise.findAndCountAll({
    where,
    limit,
    offset,
    order: [["id", "ASC"]],
  });
  return res.status(200).json({ status: "success", total: count, limit, offset, data: rows });
};

const createExerciseAdmin = async (req, res) => {
  const existing = await Exercise.findOne({ where: { nama_latihan: req.validated.nama_latihan } });
  if (existing) return res.status(409).json({ status: "fail", message: "Nama latihan sudah digunakan" });
  const exercise = await Exercise.create(req.validated);
  await audit(req, "create", "exercise", exercise.id, null, exercise.get({ plain: true }));
  return res.status(201).json({ status: "success", message: "Exercise berhasil ditambahkan", data: exercise });
};

const updateExerciseAdmin = async (req, res) => {
  const exercise = await Exercise.findByPk(req.params.id);
  if (!exercise) return res.status(404).json({ status: "fail", message: "Exercise tidak ditemukan" });
  const before = exercise.get({ plain: true });
  await exercise.update(req.validated);
  await audit(req, "update", "exercise", exercise.id, before, exercise.get({ plain: true }));
  return res.status(200).json({ status: "success", message: "Exercise berhasil diperbarui", data: exercise });
};

const deleteExerciseAdmin = async (req, res) => {
  const exercise = await Exercise.findByPk(req.params.id);
  if (!exercise) return res.status(404).json({ status: "fail", message: "Exercise tidak ditemukan" });
  const usageCount = await WorkoutLog.count({
    include: [{ model: Exercise, as: "exercises", where: { id: exercise.id }, attributes: [] }],
  });
  if (usageCount > 0) return res.status(409).json({
    status: "fail",
    message: `Exercise masih dipakai pada ${usageCount} workout log dan tidak dapat dihapus`,
  });
  await exercise.destroy();
  await audit(req, "delete", "exercise", exercise.id, exercise.get({ plain: true }), null);
  return res.status(200).json({ status: "success", message: "Exercise berhasil dihapus" });
};

const listExerciseMedia = async (req, res) => {
  const exercise = await Exercise.findByPk(req.params.id);
  if (!exercise) return res.status(404).json({ status: "fail", message: "Exercise tidak ditemukan" });
  const media = await ExerciseMedia.findAll({
    where: { exercise_id: exercise.id },
    order: [["is_primary", "DESC"], ["id", "DESC"]],
  });
  return res.status(200).json({ status: "success", data: media });
};

const createExerciseMedia = async (req, res) => {
  const exercise = await Exercise.findByPk(req.params.id);
  if (!exercise) return res.status(404).json({ status: "fail", message: "Exercise tidak ditemukan" });
  if (!req.file) return res.status(400).json({ status: "fail", message: "Field file media wajib dipilih" });

  const ext = path.extname(req.file.filename).toLowerCase();
  const mime = String(req.file.mimetype || "").toLowerCase();
  const mediaType = mime === "image/gif" || ext === ".gif"
    ? "gif"
    : mime.startsWith("video/") || [".mp4", ".webm", ".mov"].includes(ext)
      ? "video"
      : "image";
  if (req.validated.is_primary) {
    await ExerciseMedia.update({ is_primary: false }, { where: { exercise_id: exercise.id } });
  }
  const media = await ExerciseMedia.create({
    exercise_id: exercise.id,
    media_type: mediaType,
    url: `/uploads/exercises/${req.file.filename}`,
    source: req.validated.source || "upload",
    prompt: req.validated.prompt || null,
    status: "ready",
    is_primary: Boolean(req.validated.is_primary),
    credit: req.validated.credit || null,
  });
  await audit(req, "upload", "exercise_media", media.id, null, media.get({ plain: true }));
  return res.status(201).json({ status: "success", message: "Media exercise berhasil ditambahkan", data: media });
};

const deleteExerciseMedia = async (req, res) => {
  const media = await ExerciseMedia.findByPk(req.params.mediaId);
  if (!media) return res.status(404).json({ status: "fail", message: "Media tidak ditemukan" });
  if (media.url.startsWith("/uploads/")) {
    const filePath = path.join(process.cwd(), "public", media.url.replace(/^\//, ""));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  await media.destroy();
  await audit(req, "delete", "exercise_media", media.id, media.get({ plain: true }), null);
  return res.status(200).json({ status: "success", message: "Media exercise berhasil dihapus" });
};

const listUserPaymentsAdmin = async (req, res) => {
  const user = await User.findByPk(req.params.id, { paranoid: false });
  if (!user) return res.status(404).json({ status: "fail", message: "User tidak ditemukan" });
  const payments = await PaymentTransaction.findAll({ where: { user_id: user.id }, order: [["created_at", "DESC"]] });
  return res.status(200).json({ status: "success", data: payments });
};

const listUserWorkoutLogsAdmin = async (req, res) => {
  const user = await User.findByPk(req.params.id, { paranoid: false });
  if (!user) return res.status(404).json({ status: "fail", message: "User tidak ditemukan" });
  const logs = await WorkoutLog.findAll({
    where: { user_id: user.id },
    include: [{ model: Exercise, as: "exercises", attributes: ["id", "nama_latihan", "kategori"], through: { attributes: ["set", "repetition", "durasi_menit", "kalori_terbakar"] } }],
    order: [["tanggal", "DESC"]],
  });
  return res.status(200).json({ status: "success", data: logs });
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
  deleteUserAdmin,
  restoreUserAdmin,
  listExercisesAdmin,
  createExerciseAdmin,
  updateExerciseAdmin,
  deleteExerciseAdmin,
  listExerciseMedia,
  createExerciseMedia,
  deleteExerciseMedia,
  listUserPaymentsAdmin,
  listUserWorkoutLogsAdmin,
};
