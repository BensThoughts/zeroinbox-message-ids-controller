const logger = require('../loggers/log4js');

const {
  findAllMessageIds,
  deleteMessageIds,
  uploadMessageIds,
  findSendersWithMessageIdsToRemove,
  deleteSender,
  removeMessageIdsFromSender,
  uploadLoadingStatus,
} = require('../libs/mongoose.utils');

const {
  MAX_RESULTS,
} = require('../config/init.config');

const {
  publishMessageIds,
  ackUserMsg,
} = require('../libs/rabbit.utils');

const {
  getPageOfMessageIds,
} = require('../libs/api.utils');

getMessageIds = function(userMsg) {
  const userId = userMsg.content.userId;
  const accessToken = userMsg.content.accessToken;

  findAllMessageIds(userId, (err, messageIdsFromMongo) => {
    if (err) return logger.error('Error in findMessageIds(): ' + err);
    if (messageIdsFromMongo === null) {
      return logger.error('Error in findMessageIds(): messageIds === null');
    };

    const numMsgsInMongo = messageIdsFromMongo.length;
    logger.trace(userId + ' - Num of messageIds in mongo: ' + numMsgsInMongo);

    const userObj = {
      userId: userId,
      accessToken: accessToken,
    };
    let nextPageToken;
    const results = {
      newMessageIdCount: 0,
      messagesFromServer: [], // [{ id: String, messageId: String }]
    };
    const pageNumber = 0;

    getMessageIdPages(
        userObj,
        messageIdsFromMongo,
        nextPageToken,
        pageNumber,
        results,
    ).then((results) => {
      const numMsgIdCount = results.newMessageIdCount;
      logger.trace(userId + ' - Total new msgIds: ' + numMsgIdCount);
      const numMsgsFromGoogle = results.messagesFromServer.length;
      logger.trace(userId + ' - Total msgIds from Gmail: ' + numMsgsFromGoogle);

      const resultsPerPage = MAX_RESULTS;
      const messageIdTotal = results.newMessageIdCount;
      uploadLoadingStatus(
          userId,
          messageIdTotal,
          resultsPerPage,
          (err, loadingStatus) => {
            if (err) return logger.error(err);
          },
      );

      // To avoid checking for changes on the users first log in ever
      if (messageIdsFromMongo.length > 0) {
        const messageIdsFromServer =
            results.messagesFromServer.map((message) => message.id);
        removeMessageIdsNotOnGoogleServer(
            userId,
            messageIdsFromServer,
            messageIdsFromMongo,
        );
      }

      ackUserMsg(userMsg);
    }).catch((err) => {
      logger.error(
          userId + ' - Error in getMessageIdPages: ' + JSON.stringify(err),
      );
      // not sure about this being the best way
      const lastMsg = true;
      publishMessageIds(userId, accessToken, [], 0, lastMsg);
      ackUserMsg(userMsg);
    });
  });
};

/**
 * @param  {UserObj} userObj
 * @param  {Array<string>} messageIdsFromMongo
 * @param  {string} nextPageToken
 * @param  {number} pageNumber
 * @param  {Array<string>} results
 */
async function getMessageIdPages(
    userObj,
    messageIdsFromMongo,
    nextPageToken,
    pageNumber,
    results,
) {
  const accessToken = userObj.accessToken;
  const userId = userObj.userId;

  const response = await getPageOfMessageIds(
      accessToken,
      nextPageToken,
  ).catch((httpErr) => {
    // logger.error(err);
    throw new Error(httpErr);
  });

  if (response === undefined) {
    throw new Error('response === undefined from getPageOfMessageIds');
  }

  // response = {
  //    messages: [{ id: String, threadId: String }],
  //    nextPageToken: String,
  //    resultsSizeEstimate: Number
  // }

  nextPageToken = response.nextPageToken;
  const messages = response.messages;
  results.messagesFromServer = results.messagesFromServer.concat(messages);

  const newMessages = messages.filter((message) => {
    return uniqueMessageId(message.id, messageIdsFromMongo);
  });

  results.newMessageIdCount = results.newMessageIdCount + newMessages.length;

  logger.trace(userId + ' - Page Number: ' + pageNumber);
  logger.trace(userId + ' - Message Ids from GMail: ' + messages.length);
  logger.trace(userId + ' - New Message Ids: ' + newMessages.length);

  if (nextPageToken) {
    const lastMsg = false;
    publishMessageIds(userId, accessToken, newMessages, pageNumber, lastMsg);
    uploadMessageIds(userId, newMessages);
    pageNumber++;
    return getMessageIdPages(
        userObj,
        messageIdsFromMongo,
        nextPageToken,
        pageNumber,
        results,
    );
  } else {
    const lastMsg = true;
    publishMessageIds(userId, accessToken, newMessages, pageNumber, lastMsg);
    uploadMessageIds(userId, newMessages);
    return results;
  }
}

/**
 * @param  {string} messageId
 * @param  {Array<string>} messageIds
 * @return {boolean}
 */
function uniqueMessageId(messageId, messageIds) {
  const index = messageIds.indexOf(messageId);
  if (index === -1) {
    return true; // messageId is unique
  } else {
    return false; // messageId is not unique
  };
};

/**
 * @param  {string} userId
 * @param  {Array<string>} messageIdsFromServer
 * @param  {Array<string>} messageIdsFromMongo
 */
function removeMessageIdsNotOnGoogleServer(
    userId,
    messageIdsFromServer,
    messageIdsFromMongo,
) {
  const messageIdsToRemove = messageIdsFromMongo.filter((messageId) => {
    // If a messageIs is in mongo but not on the server, it needs to be removed.
    return uniqueMessageId(messageId, messageIdsFromServer);
  });

  const numMsgIdsToRemove = messageIdsToRemove.length;
  logger.trace(
      userId + ' - messageIds to remove from mongo: ' + numMsgIdsToRemove,
  );

  deleteMessageIds(userId, messageIdsToRemove, (mongoErr, res) => {
    if (mongoErr) return logger.error(userId + ' - ' + mongoErr);
  });

  findSendersWithMessageIdsToRemove(
      userId,
      messageIdsToRemove,
      (mongoErr, senders) => {
        if (mongoErr) return logger.error(userId + ' - ' + mongoErr);
        logger.trace(
            userId + ' - Senders with message Ids to remove: ' + senders.length,
        );
        senders.forEach((sender) => {
          const senderId = sender.senderId;

          const removeSender = sender.messageIds.filter((messageId) => {
            // filter for messageIds in sender that
            // are not in messageIdsToRemove
            return uniqueMessageId(
                messageId,
                messageIdsToRemove,
            );
          });

          if (removeSender.length == 0) {
            logger.trace(userId + ' - deleting senderId: ' + senderId);
            deleteSender(userId, senderId, (mongoErr, deletionResponse) => {
              if (mongoErr) return logger.error(userId + ' - ' + mongoErr);
              logger.trace(userId + ' - ' + JSON.stringify(deletionResponse));
            });
          } else {
            const logString = userId + ' - Removing messageIds from sender: ';
            logger.trace(logString + senderId);
            removeMessageIdsFromSender(
                userId,
                senderId,
                messageIdsToRemove,
                (mongoErr, updateResponse) => {
                  if (mongoErr) return logger.error(userId + ' - ' + mongoErr);
                  logger.trace(
                      userId +
                      ' - messageIds removed from sender: ' +
                      messageIdsToRemove.length,
                  );
                },
            );
          }
        });
      });
}

module.exports = getMessageIds;
