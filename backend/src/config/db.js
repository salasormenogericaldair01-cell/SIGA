const { Sequelize } = require('sequelize');
const env = require('./env');

const sequelize = new Sequelize(env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
});

module.exports = sequelize;
