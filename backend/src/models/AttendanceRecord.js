const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AttendanceRecord = sequelize.define('AttendanceRecord', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  teachingAssignmentId: { type: DataTypes.UUID, allowNull: false },
  enrollmentId: { type: DataTypes.UUID, allowNull: false },
  sectionId: { type: DataTypes.UUID, allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false, validate: { isIn: [['PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED']] } },
}, {
  tableName: 'AttendanceRecord',
  freezeTableName: true,
  timestamps: true,
});

module.exports = AttendanceRecord;
