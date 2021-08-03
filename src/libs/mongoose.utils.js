const logger = require('../loggers/log4js');
const Sender = require('../models/sender.model');
const MessageId = require('../models/messag-id.model');
const LoadingStatus = require('../models/loading-status.model');

exports.findAllMessageIds = function(userId, callback) {
  const conditions = {userId, userId};
  MessageId.find().distinct('messageId', conditions, (err, messageIds) => {
    callback(err, messageIds);
  });
};

exports.deleteMessageIds =
function deleteMessageIds(userId, messageIds, callback) {
  const conditions = {
    userId: userId,
    messageId: {
      '$in': messageIds,
    },
  };

  MessageId.deleteMany(conditions, (err, res) => {
    callback(err, res);
  });
};

/**
 * messages: [{ id: String, threadId: String }]
 * No callback on this method, kind of a fire and forget deal.
 * @param {string} userId
 * @param {Messages} messages
 */
exports.uploadMessageIds = function uploadMessageIds(userId, messages) {
  messages = messages.map((message) => {
    return {
      userId: userId,
      messageId: message.id,
      threadId: message.threadId,
    };
  });
  MessageId.insertMany(messages, (err, res) => {
    if (err) return logger.err(err);
  });
};

exports.findSendersWithMessageIdsToRemove =
function(userId, messageIdsToRemove, callback) {
  const conditions = {
    userId: userId,
    threadIds: {
      '$elemMatch': {'$in': messageIdsToRemove},
    },
  };

  const senderProjection = {
    'messageIds': 1,
    'senderId': 1,
    '_id': 0,
  };

  Sender.find(conditions, senderProjection, (err, raw) => {
    callback(err, raw);
  });
};

exports.removeMessageIdsFromSender =
function(userId, senderId, messageIdsToRemove, callback) {
  const conditions = {
    userId: userId,
    senderId: senderId,
  };

  const update = {
    '$pull': {
      messageIds: {'$in': messageIdsToRemove},
    },
  };

  Sender.updateOne(conditions, update, (err, raw) => {
    callback(err, raw);
  });
};

exports.deleteSender =
function deleteSender(userId, senderId, callback) {
  const conditions = {
    userId: userId,
    senderId: senderId,
  };

  Sender.deleteOne(conditions, (err, res) => {
    callback(err, res);
  });
};

exports.uploadLoadingStatus =
function uploadLoadingStatus(userId, messageIdTotal, resultsPerPage, callback) {
  const conditions = {userId: userId};
  const options = {
    upsert: true,
    multi: false,
  };
  const update = {
    userId: userId,
    resultsPerPage: resultsPerPage,
    messageIdTotal: messageIdTotal,
  };
  LoadingStatus.updateOne(conditions, update, options, (err, raw) => {
    callback(err, raw);
  });
};
