const rabbit = require('zero-rabbit');
const logger = require('../loggers/log4js');
const {
  userTopology,
} = require('../config/rabbit.config');

/**
 * @param  {string} userId
 * @param  {Function} callback
 */
function createQueue(userId, callback) {
  const messageIdsQueue = userTopology.queues.user_prefix + userId;
  const messageIdsExchange = userTopology.exchanges.topic.messageIds;
  const sendChannel = userTopology.channels.send;
  const key = 'user.' + userId;

  rabbit.assertQueue(
      sendChannel,
      messageIdsQueue,
      {autoDelete: false, durable: true},
      (assertQueueErr, q) => {
        if (assertQueueErr) {
          logger.error(JSON.stringify(assertQueueErr));
          callback(assertQueueErr, undefined);
        } else {
          rabbit.bindQueue(
              sendChannel,
              messageIdsQueue,
              messageIdsExchange,
              key,
              {},
              (bindQueueErr, ok) => {
                if (bindQueueErr) {
                  logger.error(binsQueueErr);
                  callback(bindQueueErr, undefined);
                } else {
                  callback(undefined, ok);
                }
              });
        }
      },
  );
}

/**
 * @param  {string} userId
 * @param  {string} accessToken
 * @param  {Array<string>} messageIds
 * @param  {number} pageNumber
 * @param  {boolean} lastMsg
 */
function publishToRabbitMQ(
    userId,
    accessToken,
    messageIds,
    pageNumber,
    lastMsg,
) {
  const message = {
    userId: userId,
    accessToken: accessToken,
    messageIds: messageIds,
    pageNumber: pageNumber,
    lastMsg: lastMsg,
  };
  const sentAt = new Date().getTime();
  const sendChannel = userTopology.channels.send;
  const messageIdsExchange = userTopology.exchanges.topic.messageIds;
  rabbit.publish(sendChannel, messageIdsExchange, 'user.' + userId, message, {
    contentType: 'application/json',
    type: 'thread ids',
    appId: 'zi-threads',
    timestamp: sentAt,
    encoding: 'string Buffer',
    persistent: true,
  });
}

exports.publishMessageIds =
function publishMessageIds(userId, accessToken, messages, pageNumber, lastMsg) {
  const messageIds = messages.map((message) => message.id);
  createQueue(userId, (err, ok) => {
    if (err) return logger.error(err);
    publishToRabbitMQ(userId, accessToken, messageIds, pageNumber, lastMsg);
  });
};

exports.ackUserMsg = function ackUserMsg(userMsg) {
  const listenChannel = userTopology.channels.listen;
  rabbit.ack(listenChannel, userMsg);
};
