const MailNotifier = require('mail-notifier');
const { simpleParser } = require('mailparser');
const axios = require('axios');
const { imap, externalApi } = require('../config/env');
const { logEmailParsing, logExternalApiCall } = require('../utils/logger');

let notifier;

const createNotifier = () => {
    return new MailNotifier({
        user: imap.user,
        password: imap.pass,
        host: imap.host,
        port: imap.port,
        tls: imap.port === 993,
    });
};

const processEmail = async (email) => {
    try {
        const parsed = await simpleParser(email.text);
        const textBody = parsed.text || '';
        let from = parsed.from
        const idMatch = textBody.match(/id\s*:\s*([a-zA-Z0-9-]+)/);
        const commentMatch = textBody.match(/Комментарий\s*:\s*([\s\S]*?)\s*(?=id\s*:|approved\s*:|$)/);
        const approvedMatch = textBody.match(/approved\s*:\s*(true|false)/);

        const messageId = idMatch ? idMatch[1] : null;
        const comment = commentMatch ? commentMatch[1].trim() : '';
        const approved = approvedMatch ? approvedMatch[1] === 'true' : false;

        logEmailParsing({ messageId, comment, approved });

        if (messageId) {
            const requestBody = {
                from: from,
                id: messageId,
                approved: approved,
                comment: comment,
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

const startNotifier = () => {
    if (notifier) {
        notifier.stop();
    }

    notifier = createNotifier();

    notifier.on('mail', processEmail);
    notifier.on('error', (error) => {
        console.error('MailNotifier error:', error);
    });

    try {
        notifier.start();
    } catch (error) {
        console.error('Failed to start notifier:', error);
    }
};

module.exports = { startNotifier, processEmail };
