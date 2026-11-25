const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const TeachingAssignment = sequelize.define('TeachingAssignment', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  courseId: { type: DataTypes.UUID, allowNull: false },
  sectionId: { type: DataTypes.UUID, allowNull: false },
  teacherId: { type: DataTypes.UUID, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'TeachingAssignment',
  freezeTableName: true,
  timestamps: true,
});

module.exports = TeachingAssignment;
