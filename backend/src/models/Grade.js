const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Grade = sequelize.define('Grade', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  educationLevelId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  order: { type: DataTypes.INTEGER, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'Grade',
  freezeTableName: true,
  timestamps: true,
});

module.exports = Grade;
