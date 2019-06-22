module.exports = {
    log_level: String(process.env.LOG_LEVEL) || 'production',
    mongo_uri: String(process.env.MONGO_URI),
    GAPI_MAX_RETRIES: Number(process.env.GAPI_MAX_RETRIES) || 3,
    GAPI_INIT_RETRY_DELAY: Number(process.env.GAPI_INIT_RETRY_DELAY) || 500,
    GAPI_DELAY_MULTIPLIER: Number(process.env.GAPI_DELAY_MULTIPLIER) || 2,
    LABEL_IDS: String(process.env.GMAIL_LABEL_IDS || 'INBOX'),

    message_ids_health_host: String(process.env.MESSAGE_IDS_HEALTH_HOST),
    message_ids_health_port: String(process.env.MESSAGE_IDS_HEALTH_PORT),
    MAX_RESULTS: Number(process.env.MESSAGE_IDS_MAX_RESULTS) || 2000,
    GMAIL_MESSAGES_ENDPOINT: String(process.env.GMAIL_MESSAGES_ENDPOINT) || 'https://www.googleapis.com/gmail/v1/users/me/messages',
}