const MailNotifier = require('mail-notifier');
const axios = require('axios');
const cheerio = require('cheerio');
const net = require('net');
const { logEmailParsing, logExternalApiCall } = require('../utils/logger');
const { externalApi } = require('../config/env');

class EmailNotifier {
    constructor() {
        this.notifier = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 15000; // 15 секунд
        this.checkInterval = 120000; // 2 минуты
        this.keepaliveInterval = 60000; // 1 минута
        this.connectionChecker = null;

        // Привязка методов
        this.startNotifier = this.startNotifier.bind(this);
        this.reconnect = this.reconnect.bind(this);
        this.checkConnection = this.checkConnection.bind(this);
        this.stopNotifier = this.stopNotifier.bind(this);
    }

    /** Создаёт и возвращает MailNotifier с конфигурацией */
    createNotifier() {
        const { IMAP_USER, IMAP_PASS, IMAP_HOST, IMAP_PORT, IMAP_TLS } = process.env;

        if (!IMAP_USER || !IMAP_PASS || !IMAP_HOST || !IMAP_PORT) {
            console.error('IMAP environment variables are not set. Check your .env configuration.');
            return null;
        }

        const useTLS = IMAP_TLS ? IMAP_TLS.trim().toLowerCase() === 'true' : false;

        return new MailNotifier({
            user: IMAP_USER,
            password: IMAP_PASS,
            host: IMAP_HOST,
            port: parseInt(IMAP_PORT, 10),
            tls: useTLS,
            keepalive: true,
            keepaliveInterval: this.keepaliveInterval,
        });
    }

    /** Проверяет доступность IMAP-сервера */
    static async isServerReachable(host, port) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(5000);
            socket.once('connect', () => {
                socket.destroy();
                resolve(true);
            });
            socket.once('error', () => {
                socket.destroy();
                resolve(false);
            });
            socket.once('timeout', () => {
                socket.destroy();
                resolve(false);
            });
            socket.connect(port, host);
        });
    }

    /** Останавливает текущее IMAP-соединение, если оно активно */
    stopNotifier() {
        if (this.notifier) {
            console.log('Stopping current notifier instance...');
            this.notifier.removeAllListeners(); // Удаляем обработчики событий
            this.notifier.stop(); // Останавливаем текущее соединение
            this.notifier = null; // Освобождаем объект
        }
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
        // Поиск id
        const idMatch = text.match(/id=([\w-]+)/); 
        
        // Поиск approved
        const approvedMatch = text.match(/approved=(true|false)/); 
        
        // Поиск комментария (если есть)
        const commentMatch = text.match(/Комментарий:\n([\s\S]*?)\n-{5,}/); // или другой разделитель, если нужен
    
        return {
            id: idMatch ? idMatch[1].trim() : null,  // id, если найдено
            approved: approvedMatch ? approvedMatch[1] === 'true' : null,  // approved, если найдено
            comment: commentMatch ? commentMatch[1].trim() : null,  // комментарий, если найдено
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
            const response = await axios.post(externalApi.url, requestBody, { headers });
            console.log(`Data successfully sent to API. Response status: ${response.status}`);
        } catch (error) {
            const status = error.response?.status || 'No status';
            const message = error.response?.data?.message || error.message || 'No message';
            console.error(`Failed to send data to API. Status: ${status}, Message: ${message}`);
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
                this.reconnect();
            })
            .on('end', () => {
                console.warn('Notifier disconnected. Reconnecting...');
                this.reconnect();
            })
            .on('close', (hasError) => {
                console.warn(`Connection closed${hasError ? ' due to error' : ''}. Reconnecting...`);
                this.reconnect();
            });
    }

    /** Запускает соединение */
    async startNotifier() {
        const { IMAP_HOST, IMAP_PORT } = process.env;

        // Останавливаем текущее соединение, если оно есть
        this.stopNotifier();

        if (!await EmailNotifier.isServerReachable(IMAP_HOST, IMAP_PORT)) {
            console.error('IMAP server is unreachable. Check network or server status.');
            return;
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
            console.error('Maximum reconnect attempts reached. Pausing reconnect attempts.');

            setTimeout(() => {
                console.log('Retrying to establish IMAP connection...');
                this.reconnectAttempts = 0;
                this.startNotifier();
            }, 300000); // повтор через 5 минут
            return;
        }

        this.reconnectAttempts += 1;
        const delay = Math.min(this.reconnectDelay * (2 ** (this.reconnectAttempts - 1)), 60000); // максимум 1 минута
        console.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}, retrying in ${delay / 1000} seconds...`);

        setTimeout(() => {
            this.stopNotifier(); // Убеждаемся, что старое соединение завершено
            this.startNotifier();
        }, delay);
    }
}

module.exports = new EmailNotifier();
