const env = require('./config/env');
const { sequelize } = require('./models');
const app = require('./app');

sequelize.authenticate()
  .then(() => {
    console.log('Base de datos PostgreSQL conectada (Sequelize).');
  })
  .catch((error) => {
    console.error(`No se pudo conectar a PostgreSQL: ${error.code || error.name || 'error desconocido'}`);
  });

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`sistema-gestion-academica-api escuchando en el puerto ${env.PORT}`);
});

server.on('error', (error) => {
  console.error(`No se pudo iniciar el servidor: ${error.code || 'error desconocido'}`);
  process.exitCode = 1;
});
