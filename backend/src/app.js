const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const createRouter = require('./routes');
const notFound = require('./middlewares/not-found.middleware');
const errorHandler = require('./middlewares/error.middleware');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', createRouter());
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

const app = createApp();
app.createApp = createApp;

module.exports = app;
