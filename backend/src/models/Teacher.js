const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Teacher = sequelize.define('Teacher', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.UUID, allowNull: false, unique: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'Teacher',
  freezeTableName: true,
  timestamps: true,
});

module.exports = Teacher;
