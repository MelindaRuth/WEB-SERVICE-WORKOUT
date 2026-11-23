const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class PaymentTransaction extends Model {}

  PaymentTransaction.init(
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      order_id: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      plan_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      plan_name_snapshot: { type: DataTypes.STRING(100), allowNull: false },
      amount_snapshot: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: "IDR" },
      status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "pending" },
      paid_at: { type: DataTypes.DATE, allowNull: true },
      premium_starts_at: { type: DataTypes.DATE, allowNull: true },
      premium_expires_at: { type: DataTypes.DATE, allowNull: true },
      signature_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      raw_status: { type: DataTypes.JSON, allowNull: true },
    },
    { sequelize, modelName: "PaymentTransaction", tableName: "payment_transactions", timestamps: true, underscored: true }
  );

  return PaymentTransaction;
};
