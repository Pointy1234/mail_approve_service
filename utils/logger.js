const winston = require('winston');
const axios = require('axios');

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
    try{

        let requestBody =
        {
            context: {
                __name: "logs",
                logs: JSON.stringify(body)
            }
        }
        const headers = {
            Authorization: `Bearer ${externalApi.token}`
        }
        axios.post('https://elma.dev.sberinsur.local/pub/v1/app/testam/logs/create', requestBody, { headers })
    }
    catch{}
    logger.info(`External API call made`, { url, method, headers, body });
};

module.exports = {
    logger,
    logEmailParsing,
    logExternalApiCall,
};
