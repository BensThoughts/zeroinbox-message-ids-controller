const rabbit = require('zero-rabbit');
const logger = require('../loggers/log4js');
const {
  rabbit_topology
} = require('../config/rabbit.config');

function createQueue(userId, callback) {
  rabbit.assertQueue(rabbit_topology.channels.send[0], 'batch-messages.message-ids.q.' + userId, { autoDelete: false, durable: true }, (assertQueueErr, q) => {
    if (assertQueueErr) {
      logger.error(assertQueueErr);
      callback(assertQueueErr, undefined)
    } else {
      rabbit.bindQueue(rabbit_topology.channels.send[0], 'batch-messages.message-ids.q.' + userId, rabbit_topology.exchanges.topic[0], 'user.' + userId, {}, (bindQueueErr, ok) => {
        if (bindQueueErr) {
          logger.error(binsQueueErr);
          callback(bindQueueErr, undefined);
        } else {
          callback(undefined, ok);
        }
      });
    }
  });
}


function publishToRabbitMQ(userId, access_token, messageIds, pageNumber, lastMsg) {
  let message = {
    userId: userId,
    access_token: access_token,
    messageIds: messageIds,
    pageNumber: pageNumber,
    lastMsg: lastMsg
  }
  let sentAt = new Date().getTime();
  rabbit.publish(rabbit_topology.channels.send[0], rabbit_topology.exchanges.topic[0], 'user.' + this.userId, message, {
    contentType: 'application/json', 
    type: 'thread ids',
    appId: 'zi-threads',
    timestamp: sentAt,
    encoding: 'string Buffer',
    persistent: true,
  });

}

exports.publishMessageIds = function publishThreadIds(userId, access_token, messages, pageNumber, lastMsg) {
  let messageIds = messages.map(message => message.id);
  createQueue((err, ok) => {
    if (err) return logger.error(err);
    publishToRabbitMQ(userId, access_token, messageIds, pageNumber, lastMsg);
  });
};