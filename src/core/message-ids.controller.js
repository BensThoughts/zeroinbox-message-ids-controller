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
  ackUserMsg
} = require('../libs/rabbit.utils');

const {
  getPageOfMessageIds
} = require('../libs/api.utils');

const rabbit = require('zero-rabbit');

getMessageIds = function (userMsg) {
  let userId = userMsg.content.userId;
  let access_token = userMsg.content.access_token;

  findAllMessageIds(userId, (err, messageIdsFromMongo) => {
    if (err) return logger.error('Error in findMessageIds(): ' + err);
    if (messageIdsFromMongo === null) return logger.error('Error in findMessageIds(): messageIds === null');
    
    logger.trace(userId + ' - Number of messageIds stored in mongo: ' + messageIdsFromMongo.length);

    let userObj = {
      userId: userId,
      access_token: access_token,
    }
    let nextPageToken;
    let results = {
      newMessageIdCount: 0,
      messagesFromServer: [] // [{ id: String, threadId: String }]
    };
    let pageNumber = 0;

    getMessageIdPages(userObj, messageIdsFromMongo, nextPageToken, pageNumber, results).then((results) => {
      logger.trace(userId + ' - Total number of new messageIds: ' + results.newMessageIdCount);
      logger.trace(userId + ' - Total number of messageIds from Google server: ' + results.messagesFromServer.length);

      let resultsPerPage = MAX_RESULTS;
      let messageIdTotal = results.newMessageIdCount;
      uploadLoadingStatus(userId, messageIdTotal, resultsPerPage, (err, loadingStatus) => {
        if (err) return logger.error(err);
      });

      // To avoid checking for changes on the users first log in ever
      if (messageIdsFromMongo.length > 0) {
        let messageIdsFromServer = results.messagesFromServer.map(message => message.id);
        removeMessageIdsNotOnGoogleServer(userId, messageIdsFromServer, messageIdsFromMongo);
      }

      ackUserMsg(userMsg);
    }).catch((err) => {
      logger.error(userId + ' - Error in getMessageIdPages(): ' + JSON.stringify(err));
      // not sure about this
      let lastMsg = true;
      publishMessageIds(userId, access_token, [], 0, lastMsg);
      ackUserMsg(userMsg);
    });

  });
}

async function getMessageIdPages(userObj, messageIdsFromMongo, nextPageToken, pageNumber, results) {

  let access_token = userObj.access_token;
  let userId = userObj.userId;

  let response = await getPageOfMessageIds(access_token, nextPageToken).catch((httpErr) => {
    // logger.error(err);
    throw new Error(httpErr);
  });

  if (response === undefined) {
    throw new Error('response === undefined from getPageOfThreads');
  }

  // response = {
  //    messages: [{ id: String, threadId: String }],
  //    nextPageToken: String,
  //    resultsSizeEstimate: Number
  // }

  nextPageToken = response.nextPageToken;
  let messages = response.messages;
  results.messagesFromServer = results.messagesFromServer.concat(messages);

  let newMessages = messages.filter((message) => {  
    return uniqueMessageId(message.id, messageIdsFromMongo);
  });
  
  results.newMessageIdCount = results.newMessageIdCount + newMessages.length;

  logger.trace(userId + ' - Page Number: ' + pageNumber);
  logger.trace(userId + ' - Number of message Ids received from google server: ' + messages.length);
  logger.trace(userId + ' - Number of new Message Ids: ' + newMessages.length);
    
  if (nextPageToken) {
    let lastMsg = false;
    publishMessageIds(userId, access_token, newMessages, pageNumber, lastMsg);
    uploadMessageIds(userId, newMessages);
    pageNumber++;
    return getMessageIdPages(userObj, messageIdsFromMongo, nextPageToken, pageNumber, results);
  } else {
    let lastMsg = true;
    publishMessageIds(userId, access_token, newMessages, pageNumber, lastMsg);
    uploadMessageIds(userId, newMessages);
    return results;
  } 
}

function uniqueMessageId(messageId, messageIds) {
  let index = messageIds.indexOf(messageId);
  if (index === -1) {
    return true; // messageId is unique
  } else {
    return false; // messageId is not unique
  };
};


function removeMessageIdsNotOnGoogleServer(userId, messageIdsFromServer, messageIdsFromMongo) {
  let messageIdsToRemove = messageIdsFromMongo.filter((messageId) => {
    return uniqueMessageId(messageId, messageIdsFromServer); // If a messageIs is in mongo but not on the server, it needs to be removed.
  });

  logger.trace(userId + ' - Number of messageIds to remove from mongo: ' + messageIdsToRemove.length);
  
  deleteMessageIds(userId, messageIdsToRemove, (mongoErr, res) => {
    if (mongoErr) return logger.error(userId + ' - ' + mongoErr);
  });

  findSendersWithMessageIdsToRemove(userId, messageIdsToRemove, (mongoErr, senders) => {
    if (mongoErr) return logger.error(userId + ' - ' + mongoErr);
    logger.trace(userId + ' - Number of senders with message Ids to remove: ' + senders.length);
    senders.forEach((sender) => {
      let senderId = sender.senderId;

      let removeSender = sender.messageIds.filter((messageId) => {
        return uniqueMessageId(messageId, messageIdsToRemove); // filter for messageIds in sender that are not in messageIdsToRemove
      });

      if (removeSender.length == 0) {
        logger.trace(userId + ' - All messageIds in sender are messageIdsToRemove, deleting senderId: ' + senderId)
        deleteSender(userId, senderId, (mongoErr, deletionResponse) => {
          if (mongoErr) return logger.error(userId + ' - ' + mongoErr);
          logger.trace(userId + ' - ' + 'senderId: ' + senderId + ' - Sender deleted because of external removal: ' + deletionResponse);
        });
      } else {
        logger.trace(userId + ' - Removing messageIds no longer on Google server from senderId: ' + senderId);
        removeMessageIdsFromSender(userId, senderId, messageIdsToRemove, (mongoErr, updateResponse) => {
          if (mongoErr) return logger.error(userId + ' - ' + mongoErr);
          logger.trace(userId + ' - ' + 'senderId: ' + senderId + ' - messageIds removed from sender: ' + messageIdsToRemove.length);
        })
      }
    });
  });

}

module.exports = getMessageIds;