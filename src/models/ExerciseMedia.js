const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ExerciseMedia extends Model {}

  ExerciseMedia.init(
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      exercise_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      media_type: {
        type: DataTypes.ENUM("image", "gif", "video"),
        allowNull: false,
        defaultValue: "image",
      },
      url: { type: DataTypes.STRING(500), allowNull: false },
      thumbnail_url: { type: DataTypes.STRING(500), allowNull: true },
      source: { type: DataTypes.ENUM("upload", "text_to_image", "external"), allowNull: false, defaultValue: "upload" },
      prompt: { type: DataTypes.TEXT, allowNull: true },
      status: { type: DataTypes.ENUM("pending", "ready", "failed"), allowNull: false, defaultValue: "ready" },
      is_primary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      credit: { type: DataTypes.STRING(255), allowNull: true },
    },
    {
      sequelize,
      modelName: "ExerciseMedia",
      tableName: "exercise_media",
      timestamps: true,
      underscored: true,
    }
  );

  return ExerciseMedia;
};
