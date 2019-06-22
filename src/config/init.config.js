module.exports = {
    mongo_uri: process.env.MONGO_URI,
    message_ids_health_host: process.env.MESSAGE_IDS_HEALTH_HOST,
    message_ids_health_port: process.env.MESSAGE_IDS_HEALTH_PORT,
    LABEL_IDS: process.env.GMAIL_LABEL_IDS || 'INBOX',
    MAX_RESULTS: process.env.THREAD_IDS_MAX_RESULTS || 2000,
    GMAIL_MESSAGES_ENDPOINT: process.env.GMAIL_MESSAGES_ENDPOINT || 'https://www.googleapis.com/gmail/v1/users/me/messages',
    log_level: process.env.LOG_LEVEL || 'production',
    GAPI_MAX_RETRIES: process.env.GAPI_MAX_RETRIES || 3,
    GAPI_INIT_RETRY_DELAY: process.env.GAPI_INIT_RETRY_DELAY || 500,
    GAPI_DELAY_MULTIPLIER: process.env.GAPI_DELAY_MULTIPLIER || 2,
}