const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class PricingPlan extends Model {}

  PricingPlan.init(
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      code: { type: DataTypes.STRING(40), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, validate: { min: { args: [0], msg: "Field price tidak boleh negatif" } } },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: "IDR" },
      duration_days: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, validate: { min: { args: [1], msg: "Field duration_days minimal 1 hari" } } },
      features: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      sort_order: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    },
    { sequelize, modelName: "PricingPlan", tableName: "pricing_plans", timestamps: true, underscored: true }
  );

  return PricingPlan;
};
