const env = require('./config/env');
const app = require('./app');

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`sistema-gestion-academica-api escuchando en el puerto ${env.PORT}`);
});

server.on('error', (error) => {
  console.error(`No se pudo iniciar el servidor: ${error.code || 'error desconocido'}`);
  process.exitCode = 1;
});
