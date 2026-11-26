const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class RefreshSession extends Model {
    static associate(models) {
      RefreshSession.belongsTo(models.User, { foreignKey: "user_id", as: "user" });
    }
  }

  RefreshSession.init(
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      family_id: { type: DataTypes.STRING(64), allowNull: false },
      revoked_at: { type: DataTypes.DATE, allowNull: true },
      revoked_reason: { type: DataTypes.STRING(80), allowNull: true },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      ip_address: { type: DataTypes.STRING(45), allowNull: true },
      user_agent: { type: DataTypes.STRING(500), allowNull: true },
    },
    {
      sequelize,
      modelName: "RefreshSession",
      tableName: "refresh_sessions",
      timestamps: true,
      underscored: true,
    }
  );

  return RefreshSession;
};
