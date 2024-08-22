const MailNotifier = require('mail-notifier');
const { simpleParser } = require('mailparser');
const axios = require('axios');
const { imap, externalApi } = require('../config/env');
const { logEmailParsing, logExternalApiCall } = require('../utils/logger');
const { parseEmailContent } = require('../utils/emailParser');

const notifier = new MailNotifier({
    user: imap.user,
    password: imap.pass,
    host: imap.host,
    port: imap.port,
    tls: imap.port === 993,
});


const processEmail = async (email) => {
    try {
        const parsed = await simpleParser(email.text);
        const { text: textBody } = parsed;

        const { id, comment, approved } = parseEmailContent(textBody);

        logEmailParsing({ id, comment, approved });

        if (id) {
            const requestBody = {
                id,
                approved,
                comment,
            };
            const headers = {
                Authorization: `Bearer ${externalApi.token}`,
                'Content-Type': 'application/json',
            };

            logExternalApiCall({ url: externalApi.url, method: 'POST', headers, body: requestBody });

            await axios.post(externalApi.url, requestBody, { headers });
        }
    } catch (error) {
        console.error('Failed to process email:', error);
    }
};

notifier.on('mail', processEmail);

const startNotifier = () => {
    notifier.start();
};

module.exports = { startNotifier, processEmail };
