const MailNotifier = require('mail-notifier');
const axios = require('axios');
const cheerio = require('cheerio');
const { logEmailParsing, logExternalApiCall } = require('../utils/logger');
const { externalApi } = require('../config/env');

class EmailNotifier {
    constructor() {
        this.notifier = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 5000; // 5 секунд
    }

    // Создание экземпляра MailNotifier
    createNotifier() {
        return new MailNotifier({
            user: process.env.IMAP_USER,
            password: process.env.IMAP_PASS,
            host: process.env.IMAP_HOST,
            port: parseInt(process.env.IMAP_PORT, 10),
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            debug: false,
            keepalive: true,
            keepaliveInterval: 10000, // Интервал keep-alive (10 секунд)
        });
    }

    // Преобразование HTML-содержимого письма в текст
    static parseHtmlContent(htmlContent) {
        try {
            const $ = cheerio.load(htmlContent);
            return $('body').text().replace(/\s+/g, ' ').trim();
        } catch (error) {
            console.error('Failed to parse HTML content:', error);
            return null;
        }
    }

    // Извлечение данных из текста письма
    static extractData(emailText) {
        try {
            const idMatch = emailText.match(/id:\s*([\w-]+)/i);
            const approvedMatch = emailText.match(/approved:\s*(true|false)/i);
            const commentMatch = emailText.match(/Комментарий:\s*(.*?)(?=\s*id:|$)/i);

            return {
                id: idMatch ? idMatch[1].trim() : null,
                approved: approvedMatch ? approvedMatch[1] === 'true' : null,
                comment: commentMatch ? commentMatch[1].trim() : null,
            };
        } catch (error) {
            console.error('Failed to extract data from email text:', error);
            return { id: null, approved: null, comment: null };
        }
    }

    // Обработка письма
    async processEmail(email) {
        try {
            let textBody = email.text;
            if (!textBody && email.html) {
                textBody = EmailNotifier.parseHtmlContent(email.html);
            }

            if (!textBody) {
                console.warn('Email text is empty, skipping processing.');
                return;
            }

            console.log('Processing email:', textBody);

            const fromEmail = email.from[0]?.address || 'unknown';
            const { id: messageId, approved, comment } = EmailNotifier.extractData(textBody);

            logEmailParsing({ fromEmail, messageId, approved, comment });

            if (messageId) {
                const requestBody = { from: fromEmail, id: messageId, approved, comment };
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
    }

    // Запуск MailNotifier
    startNotifier() {
        if (this.notifier?.running) {
            console.log('Stopping existing notifier...');
            this.notifier.stop();
        }

        this.notifier = this.createNotifier();

        this.notifier
            .on('mail', async (email) => {
                console.log('New email received, processing...');
                await this.processEmail(email);
            })
            .on('connected', () => {
                console.log('Notifier connected to IMAP server.');
                this.reconnectAttempts = 0; // Сбросить счётчик попыток
            })
            .on('error', (error) => {
                console.error('MailNotifier error:', error);
                this.handleReconnect();
            })
            .on('end', () => {
                console.warn('Notifier disconnected, attempting to reconnect...');
                this.handleReconnect();
            })
            .on('close', (hasError) => {
                console.warn(`Notifier connection closed${hasError ? ' due to error' : ''}.`);
                this.handleReconnect();
            });

        console.log('Starting notifier...');
        this.notifier.start();
    }

    // Логика переподключения
    handleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Maximum reconnect attempts reached. Stopping notifier.');
            return;
        }

        if (this.notifier?.running) {
            this.notifier.stop();
        }

        this.reconnectAttempts += 1;
        console.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay / 1000} seconds...`);
        setTimeout(() => {
            this.startNotifier();
        }, this.reconnectDelay);
    }
}

module.exports = new EmailNotifier();
