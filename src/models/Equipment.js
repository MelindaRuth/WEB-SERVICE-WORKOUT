const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Equipment extends Model {}

  Equipment.init(
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        set(value) { this.setDataValue("name", String(value).trim().replace(/\s+/g, " ")); },
        validate: { notEmpty: { msg: "Field name tidak boleh kosong" } },
      },
      slug: {
        type: DataTypes.STRING(60),
        allowNull: false,
        unique: true,
        set(value) { this.setDataValue("slug", String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")); },
        validate: { notEmpty: { msg: "Field slug tidak boleh kosong" } },
      },
      description: { type: DataTypes.TEXT, allowNull: true },
      icon: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "🏋️" },
      aliases: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
      category: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "other" },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      sort_order: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    },
    {
      sequelize,
      modelName: "Equipment",
      tableName: "equipments",
      timestamps: true,
      paranoid: true,
      underscored: true,
    }
  );

  return Equipment;
};
