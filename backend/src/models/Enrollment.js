const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Enrollment = sequelize.define('Enrollment', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  studentId: { type: DataTypes.UUID, allowNull: false },
  sectionId: { type: DataTypes.UUID, allowNull: false },
  academicPeriodId: { type: DataTypes.UUID, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'ACTIVE', validate: { isIn: [['ACTIVE', 'CANCELLED']] } },
}, {
  tableName: 'Enrollment',
  freezeTableName: true,
  timestamps: true,
});

module.exports = Enrollment;
