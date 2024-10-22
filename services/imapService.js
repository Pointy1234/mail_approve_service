const MailNotifier = require('mail-notifier');
const { simpleParser } = require('mailparser');
const axios = require('axios');
const { imap, externalApi } = require('../config/env');
const { logEmailParsing, logExternalApiCall } = require('../utils/logger');
const { text } = require('body-parser');

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

// Функция для извлечения данных из текста письма
function extractData(emailText) {
    const idMatch = emailText.match(/id:\s*([\w-]+)/);
    const approvedMatch = emailText.match(/approved:\s*(true|false)/);
    const commentMatch = emailText.match(/Комментарий:\s*(.*?)(?=\s*id:|$)/); // Извлечение комментария

    const id = idMatch ? idMatch[1].trim() : null;
    const approved = approvedMatch ? approvedMatch[1] === 'true' : null;
    const comment = commentMatch ? commentMatch[1].trim() : null; // Текст комментария или null

    return {
        comment,
        id,
        approved
    };
}



const processEmail = async (email) => {
    try {
        const textBody = email.text;
        console.log('email_text: ',email.text);
        
        //Извлекаем отправителя
        const fromEmail = email.from[0].address || 'unknown';

        // Извлекаем данные из текста письма
        const { comment, id: messageId, approved } = extractData(textBody);

        // Логируем процесс парсинга письма
        logEmailParsing({ fromEmail, messageId, comment, approved });

        // Отправляем данные на внешний API, если найден id
        if (messageId) {
            const requestBody = {
                from: fromEmail,
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
