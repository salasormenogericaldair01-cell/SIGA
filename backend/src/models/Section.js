const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Section = sequelize.define('Section', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  gradeId: { type: DataTypes.UUID, allowNull: false },
  academicPeriodId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'Section',
  freezeTableName: true,
  timestamps: true,
});

module.exports = Section;
