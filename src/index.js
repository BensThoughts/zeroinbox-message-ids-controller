const logger = require('./loggers/log4js');

const rabbit = require('zero-rabbit');
const { 
  rabbit_config,
  rabbit_topology,
} = require('./config/rabbit.config');

const mongoose = require('mongoose');
const { 
  MONGO_URI,
  MESSAGE_IDS_HEALTH_HOST,
  MESSAGE_IDS_HEALTH_PORT
} = require('./config/init.config');

// Print out the value of all env vars
let envVars = require('./config/init.config');
Object.keys(envVars).forEach((envVar) => {
  logger.info(envVar + ': ' + envVars[envVar]);
});

const express = require('express');
const KubeHealthCheck = express();
KubeHealthCheck.get('/healthz', (req, res, next) => {
  res.status(200).send();
});

const getMessageIds = require('./core/message-ids.controller');

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true }, (err, db) => {
  if (err) {
    logger.error('Error in index.js at mongoose.connect(): ' + err);
  } else {
    logger.info('Connected to MongoDB!');

    rabbit.connect(rabbit_config, (err, ch) => {
      logger.info('Connected to RabbitMQ!');
      let listenChannel = rabbit_topology.channels.listen;
      let userIdsQueue = rabbit_topology.queues.user_id;
      rabbit.consume(listenChannel, userIdsQueue, (userMsg) => {
        let message = JSON.stringify(userMsg.content);
        let userId = userMsg.content.userId;
        logger.trace(userId + ' - userMsg.content received: ' + message);
        getMessageIds(userMsg);
      }, { noAck: false });

      let server = KubeHealthCheck.listen(MESSAGE_IDS_HEALTH_PORT, MESSAGE_IDS_HEALTH_HOST);
      processHandler(server);
      logger.info(`Running health check on http://${MESSAGE_IDS_HEALTH_HOST}:${MESSAGE_IDS_HEALTH_PORT}`);
    });

  };
});

// Graceful shutdown SIG handling
const signals= {
  'SIGTERM': 15
}

function processHandler(server) {
  Object.keys(signals).forEach((signal) => {
    process.on(signal, () => {
      logger.info(`Process received a ${signal} signal`);
      shutdown(server, signal, signals[signal]);
    });
  });
}

const shutdown = (server, signal, value) => {
  logger.info('shutdown!');
    logger.info(`Server stopped by ${signal} with value ${value}`);
    rabbit.disconnect(() => {
      logger.info('Rabbit disconnected!');
      mongoose.disconnect((error) => {

      });
      server.close(() => {

      })
      logger.info('Mongo disconnected!')
    });
};