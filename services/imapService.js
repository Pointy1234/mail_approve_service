const MailNotifier = require('mail-notifier');
const { simpleParser } = require('mailparser');
const axios = require('axios');
const { imap, externalApi } = require('../config/env');
const { logEmailParsing, logExternalApiCall } = require('../utils/logger');
const { text } = require('body-parser');
const cheerio = require('cheerio');
let notifier;

const createNotifier = () => {
    return new MailNotifier({
        user: process.env.IMAP_USER,
        password: process.env.IMAP_PASS,
        host: process.env.IMAP_HOST,
        port: parseInt(process.env.IMAP_PORT, 10),
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        debug: console.log
    });
};


// Функция для извлечения данных из текста письма
function extractData(emailText) {
    const idMatch = emailText.match(/id:\s*([\w-]+)/) ?? undefined;
    const approvedMatch = emailText.match(/approved:\s*(true|false)/) ?? undefined;
    const commentMatch = emailText.match(/Комментарий:\s*(.*?)(?=\s*id:|$)/) ?? undefined; // Извлечение комментария

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
        // Используем text или html в зависимости от наличия данных
        let textBody = email.text;
        let parsed;
        if (!textBody && email.html) {
            // Если text отсутствует, используем html и преобразуем его в текст
            const parsedEmail = parseHtmlContent(email.html);
            parsed = parsedEmail
            textBody = parsedEmail; // Получаем текстовое представление из HTML
        }

        // if (!textBody) return;

        console.log('email_text:', textBody);

        // Извлекаем отправителя
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
                email: email,
                parsed: parsed
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

function parseHtmlContent(htmlContent) {
    // Загрузка HTML с помощью cheerio
    const $ = cheerio.load(htmlContent);

    // Извлечение текста с учетом разделителей между элементами
    const textContent = $('body').text().replace(/\s+/g, ' ').trim();

    return textContent;
}



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
