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

function httpGetPageOfMessageIdsPromise(accessToken, pageToken) {
  return new Promise((resolve, reject) => {
    let options = createOptions(accessToken, pageToken);

    request.get(options, (error, response, body) => {

      if (!error && response.statusCode == 200) {
        body = JSON.parse(body);
        resolve(body)
      } else {
        let httpError = {
          urlError: 'GET - Error contacting ' + options.url + ': ' + error,
          errorBody: JSON.stringify(error)
        }
        reject(httpError);
      }

    });

  });

}

function createOptions(accessToken, pageToken) {
  if (pageToken) {
    return {
        url: GMAIL_MESSAGES_ENDPOINT,
        headers: {
          'Authorization': 'Bearer ' + accessToken
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
          'Authorization': 'Bearer ' + accessToken
        },
        qs: {
          maxResults: MAX_RESULTS,
          labelIds: LABEL_IDS,
        }
    }
  }
}

exports.getPageOfMessageIds = function(accessToken, pageToken) {
  let retries = GAPI_MAX_RETRIES;
  let delay = GAPI_INIT_RETRY_DELAY;
  let delayMultiplier = GAPI_DELAY_MULTIPLIER;
  let promiseCreator = () => httpGetPageOfMessageIdsPromise(accessToken, pageToken);
  // logger.trace(options);
  return retryPromise(promiseCreator, retries, delay, delayMultiplier);
}