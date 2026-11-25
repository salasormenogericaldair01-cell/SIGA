const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const EducationLevel = sequelize.define('EducationLevel', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  code: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isIn: [['INICIAL', 'PRIMARIA', 'SECUNDARIA']] } },
  name: { type: DataTypes.STRING, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'EducationLevel',
  freezeTableName: true,
  timestamps: true,
});

module.exports = EducationLevel;
