const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'app.log' }),
        new winston.transports.Console(),
    ],
});

const logEmailParsing = (parsedEmail) => {
    logger.info('Parsed email content:', parsedEmail);
};

const logExternalApiCall = ({ url, method, headers, body }) => {
    logger.info(`External API call made`, { url, method, headers, body });
};

module.exports = {
    logger,
    logEmailParsing,
    logExternalApiCall,
};
