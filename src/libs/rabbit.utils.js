const rabbit = require('zero-rabbit');
const logger = require('../loggers/log4js');
const {
  rabbit_topology
} = require('../config/rabbit.config');

function createQueue(userId, callback) {
  let messageIdsQueue = rabbit_topology.queues.user_prefix + userId;
  let messageIdsExchange = rabbit_topology.exchanges.topic.messageIds;
  let sendChannel = rabbit_topology.channels.send;
  let key = 'user.' + userId;

  rabbit.assertQueue(sendChannel, messageIdsQueue, { autoDelete: false, durable: true }, (assertQueueErr, q) => {
    if (assertQueueErr) {
      logger.error(assertQueueErr);
      callback(assertQueueErr, undefined)
    } else {
      rabbit.bindQueue(sendChannel, messageIdsQueue, messageIdsExchange, key, {}, (bindQueueErr, ok) => {
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
  let sendChannel = rabbit_topology.channels.send;
  let messageIdsExchange = rabbit_topology.exchanges.topic.messageIds;
  rabbit.publish(sendChannel, messageIdsExchange, 'user.' + userId, message, {
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
  createQueue(userId, (err, ok) => {
    if (err) return logger.error(err);
    publishToRabbitMQ(userId, access_token, messageIds, pageNumber, lastMsg);
  });
};

exports.ackUserMsg = function ackUserMsg(userMsg) {
  let listenChannel = rabbit_topology.channels.listen;
  rabbit.ack(listenChannel, userMsg);
}