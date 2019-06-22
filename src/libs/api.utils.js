const logger = require('../loggers/log4js');
const request = require('request');

const {
  LABEL_IDS,
  MAX_RESULTS,
  GAPI_DELAY_MULTIPLIER,
  GAPI_MAX_RETRIES,
  GAPI_INIT_RETRY_DELAY,
  GMAIL_MESSAGES_ENDPOINT
} = require('../config/init.config');

function retryPromise(promiseCreator, retries, delay, delayMultiplier) {
  return new Promise((resolve, reject) => {
    promiseCreator()
      .then(resolve)
      .catch((err) => {
        if (retries == 0) {
          reject(err);
        } else {
          let retryFunc = function() {
            retries--;
            delay = delay * delayMultiplier;
            resolve(retryPromise(promiseCreator, retries, delay, delayMultiplier));
          }
          setTimeout(retryFunc, delay);
        }
      });
    });
}

function httpGetPageOfMessageIdsPromise(access_token, pageToken) {
  return new Promise((resolve, reject) => {
    let options = createOptions(access_token, pageToken);

    request.get(options, (error, response, body) => {

      if (!error && response.statusCode == 200) {
        body = JSON.parse(body);
        logger.debug('Next page token: ' + body.nextPageToken);
        resolve(body)
      } else {
        logger.error('Error in getPageOfMessageIdsPromise() at request.get(): ' + error);
        logger.error('Error body: ' + JSON.stringify(body));
        reject(error);
      }

    });

  });

}

function createOptions(access_token, pageToken) {
  if (pageToken) {
    return {
        url: GMAIL_MESSAGES_ENDPOINT,
        headers: {
          'Authorization': 'Bearer ' + access_token
        },
        qs: {
          maxResults: MAX_RESULTS,
          labelIds: LABEL_IDS,
          pageToken: pageToken
        },
    };
  } else {
    return {
        url: GMAIL_MESSAGES_ENDPOINT,
        headers: {
          'Authorization': 'Bearer ' + access_token
        },
        qs: {
          maxResults: MAX_RESULTS,
          labelIds: LABEL_IDS,
        }
    }
  }
}

exports.getPageOfMessageIds = function(access_token, pageToken) {
  let retries = GAPI_MAX_RETRIES;
  let delay = GAPI_INIT_RETRY_DELAY;
  let delayMultiplier = GAPI_DELAY_MULTIPLIER;
  let promiseCreator = () => httpGetPageOfMessageIdsPromise(access_token, pageToken);
  // logger.trace(options);
  return retryPromise(promiseCreator, retries, delay, delayMultiplier);
}