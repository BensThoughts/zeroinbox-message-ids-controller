const logger = require('./loggers/log4js');

const rabbit = require('zero-rabbit');
const {
  rabbitConfig,
  userTopology,
} = require('./config/rabbit.config');

const mongoose = require('mongoose');
const {
  MONGO_URI,
  MESSAGE_IDS_HEALTH_HOST,
  MESSAGE_IDS_HEALTH_PORT,
} = require('./config/init.config');

// Print out the value of all env vars
const envVars = require('./config/init.config');
Object.keys(envVars).forEach((envVar) => {
  logger.info(envVar + ': ' + envVars[envVar]);
});

const express = require('express');
const KubeHealthCheck = express();
KubeHealthCheck.get('/healthz', (req, res, next) => {
  res.status(200).send();
});

const getMessageIds = require('./core/message-ids.controller');

mongoose.connect(
    MONGO_URI,
    {useNewUrlParser: true, useUnifiedTopology: true},
    (err, db) => {
      if (err) {
        logger.error('Error in index.js at mongoose.connect(): ' + err);
      } else {
        logger.info('Connected to MongoDB!');

        rabbit.connect(rabbitConfig, (err, ch) => {
          logger.info('Connected to RabbitMQ!');

          // If getting EADDR Already in use, probably rabbit.connect has
          // tried to reconnect/reload
          const server =
            KubeHealthCheck
                .listen(MESSAGE_IDS_HEALTH_PORT, MESSAGE_IDS_HEALTH_HOST);
          processHandler(server);
          logger.info(`Running health check on http://${MESSAGE_IDS_HEALTH_HOST}:${MESSAGE_IDS_HEALTH_PORT}`);

          const listenChannel = userTopology.channels.listen;
          const userIdsQueue = userTopology.queues.user_id;
          rabbit.consume(listenChannel, userIdsQueue, (userMsg) => {
            getMessageIds(userMsg);
          }, {noAck: false});
        });
      };
    },
);

// Graceful shutdown SIG handling
/**
 * @param  {ExpressJs} server
 */
function processHandler(server) {
  const signals = {
    'SIGHUP': 1,
    'SIGINT': 2,
    'SIGQUIT': 3,
    'SIGABRT': 6,
    // 'SIGKILL': 9, // doesn't work
    'SIGTERM': 15,
  };

  Object.keys(signals).forEach((signal) => {
    process.on(signal, () => {
      logger.info(`Process received a ${signal} signal`);
      shutdown(server, signal, signals[signal]);
    });
  });
}

const shutdown = (server, signal, value) => {
  logger.info(`Server stopped by ${signal} with value ${value}`);
  rabbit.disconnect(() => {
    logger.info('Rabbit disconnected!');

    mongoose.disconnect((error) => {
      if (error) {
        logger.error('Mongo disconnect error: ' + error);
      }
      logger.info('Mongo disconnected gracefully!');
    });
    server.close(() => {

    });
  });
};
