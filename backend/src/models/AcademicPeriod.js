const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AcademicPeriod = sequelize.define('AcademicPeriod', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  startDate: { type: DataTypes.DATEONLY, allowNull: false },
  endDate: { type: DataTypes.DATEONLY, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'AcademicPeriod',
  freezeTableName: true,
  timestamps: true,
});

module.exports = AcademicPeriod;
