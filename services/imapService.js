const MailNotifier = require('mail-notifier');
const axios = require('axios');
const cheerio = require('cheerio');
const { logEmailParsing, logExternalApiCall } = require('../utils/logger');
const { externalApi } = require('../config/env');

class EmailNotifier {
    constructor() {
        this.notifier = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 15000; // 15 секунд
        this.checkInterval = 120000; // 2 минуты
        this.keepaliveInterval = 300000; // 5 минут
        this.connectionChecker = null;

        // Привязка методов
        this.startNotifier = this.startNotifier.bind(this);
        this.reconnect = this.reconnect.bind(this);
        this.checkConnection = this.checkConnection.bind(this);
    }

    /** Создаёт и возвращает MailNotifier с конфигурацией */
    createNotifier() {
        const { IMAP_USER, IMAP_PASS, IMAP_HOST, IMAP_PORT } = process.env;

        if (!IMAP_USER || !IMAP_PASS || !IMAP_HOST || !IMAP_PORT) {
            console.error('IMAP environment variables are not set. Check your .env configuration.');
            return null;
        }

        return new MailNotifier({
            user: IMAP_USER,
            password: IMAP_PASS,
            host: IMAP_HOST,
            port: parseInt(IMAP_PORT, 10),
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            keepalive: true,
            keepaliveInterval: this.keepaliveInterval,
        });
    }

    /** Обрабатывает тело письма (текст/HTML) */
    static parseEmailBody(email) {
        if (email.text) return email.text;

        if (email.html) {
            try {
                const $ = cheerio.load(email.html);
                return $('body').text().replace(/\s+/g, ' ').trim();
            } catch (error) {
                console.error('Error parsing HTML content:', error);
            }
        }

        return null;
    }

    /** Извлекает данные из текста письма */
    static extractDataFromEmail(text) {
        const idMatch = text.match(/id:\s*([\w-]+)/i);
        const approvedMatch = text.match(/approved:\s*(true|false)/i);
        const commentMatch = text.match(/Комментарий:\s*(.*?)(?=\s*id:|$)/i);

        return {
            id: idMatch ? idMatch[1].trim() : null,
            approved: approvedMatch ? approvedMatch[1] === 'true' : null,
            comment: commentMatch ? commentMatch[1].trim() : null,
        };
    }

    /** Отправляет данные на внешний API */
    async sendToApi(emailData) {
        const { fromEmail, id, approved, comment } = emailData;
        const requestBody = { from: fromEmail, id, approved, comment };
        const headers = {
            Authorization: `Bearer ${externalApi.token}`,
            'Content-Type': 'application/json',
        };

        logExternalApiCall({ url: externalApi.url, method: 'POST', headers, body: requestBody });

        try {
            await axios.post(externalApi.url, requestBody, { headers });
        } catch (error) {
            console.error('Failed to send data to API:', error);
        }
    }

    /** Обрабатывает письмо */
    async processEmail(email) {
        const textBody = EmailNotifier.parseEmailBody(email);
        if (!textBody) {
            console.warn('Email content is empty, skipping...');
            return;
        }

        const fromEmail = email.from[0]?.address || 'unknown';
        const extractedData = EmailNotifier.extractDataFromEmail(textBody);
        const emailData = { fromEmail, ...extractedData };

        logEmailParsing(emailData);

        if (extractedData.id) {
            await this.sendToApi(emailData);
        }
    }

    /** Устанавливает обработчики событий */
    setupNotifierHandlers() {
        this.notifier
            .on('mail', async (email) => {
                console.log('New email received, processing...');
                await this.processEmail(email);
            })
            .on('connected', () => {
                console.log('Notifier connected to IMAP server.');
                this.reconnectAttempts = 0;
            })
            .on('error', (error) => {
                console.error('MailNotifier error:', error);
                if (error.code === 'EPIPE') {
                    console.warn('EPIPE error detected. Resetting connection...');
                }
                this.reconnect();
            })
            .on('end', () => {
                console.warn('Notifier disconnected. Reconnecting...');
                this.reconnect();
            })
            .on('close', (hasError) => {
                console.warn(`Connection closed${hasError ? ' due to error' : ''}.`);
                this.reconnect();
            });
    }

    /** Запускает соединение */
    startNotifier() {
        if (this.notifier?.running) {
            console.log('Notifier is already running. Restarting...');
            this.notifier.stop();
        }

        this.notifier = this.createNotifier();
        if (!this.notifier) return;

        this.setupNotifierHandlers();
        console.log('Starting notifier...');
        this.notifier.start();

        // Запускаем проверку соединения
        this.startConnectionCheck();
    }

    /** Проверяет активность соединения каждые 2 минуты */
    startConnectionCheck() {
        if (this.connectionChecker) clearInterval(this.connectionChecker);

        this.connectionChecker = setInterval(this.checkConnection, this.checkInterval);
    }

    /** Проверяет и восстанавливает соединение */
    checkConnection() {
        if (!this.notifier?.running) {
            console.warn('IMAP connection is not active. Reconnecting...');
            this.reconnect();
        } else {
            console.log('IMAP connection is active.');
        }
    }

    /** Выполняет повторное подключение */
    reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Maximum reconnect attempts reached. Stopping further attempts.');
            return;
        }

        this.reconnectAttempts += 1;
        console.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);

        setTimeout(() => this.startNotifier(), this.reconnectDelay);
    }
}

module.exports = new EmailNotifier();
