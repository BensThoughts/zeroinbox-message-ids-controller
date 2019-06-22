const logger = require('./loggers/log4js');

const rabbit = require('zero-rabbit');
const { 
  rabbit_config,
  rabbit_topology,
} = require('./config/rabbit.config');

const mongoose = require('mongoose');
const { 
  mongo_uri,
  message_ids_health_host,
  message_ids_health_port
} = require('./config/init.config');

const express = require('express');
const KubeHealthCheck = express();
KubeHealthCheck.get('/healthz', (req, res, next) => {
  res.status(200).send();
});

const getMessageIds = require('./core/message-ids.controller');

mongoose.connect(mongo_uri, { useNewUrlParser: true }, (err, db) => {
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

      let server = KubeHealthCheck.listen(message_ids_health_port, message_ids_health_host);
      processHandler(server);
      logger.info(`Running health check on http://${message_ids_health_host}:${message_ids_health_port}`);
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