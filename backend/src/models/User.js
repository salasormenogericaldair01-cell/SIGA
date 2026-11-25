const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  tokenVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  firstName: { type: DataTypes.STRING, allowNull: false },
  lastName: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, allowNull: false, validate: { isIn: [['ADMIN', 'SECRETARIA', 'DOCENTE', 'ESTUDIANTE']] } },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'User',
  freezeTableName: true,
  timestamps: true,
});

module.exports = User;
