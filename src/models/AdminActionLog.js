const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class AdminActionLog extends Model {}

  AdminActionLog.init(
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      admin_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      action: { type: DataTypes.STRING(50), allowNull: false },
      entity_type: { type: DataTypes.STRING(50), allowNull: false },
      entity_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      before_data: { type: DataTypes.JSON, allowNull: true },
      after_data: { type: DataTypes.JSON, allowNull: true },
      ip_address: { type: DataTypes.STRING(45), allowNull: true },
    },
    { sequelize, modelName: "AdminActionLog", tableName: "admin_action_logs", timestamps: true, updatedAt: false, underscored: true }
  );

  return AdminActionLog;
};
