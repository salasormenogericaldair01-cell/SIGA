const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const GradeRecord = sequelize.define('GradeRecord', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  teachingAssignmentId: { type: DataTypes.UUID, allowNull: false },
  enrollmentId: { type: DataTypes.UUID, allowNull: false },
  sectionId: { type: DataTypes.UUID, allowNull: false },
  term: { type: DataTypes.INTEGER, allowNull: false },
  value: { type: DataTypes.STRING, allowNull: false, validate: { isIn: [['AD', 'A', 'B', 'C']] } },
}, {
  tableName: 'GradeRecord',
  freezeTableName: true,
  timestamps: true,
});

module.exports = GradeRecord;
