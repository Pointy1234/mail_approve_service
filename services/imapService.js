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

        // Привязка методов для сохранения контекста
        this.startNotifier = this.startNotifier.bind(this);
        this.handleReconnect = this.handleReconnect.bind(this);
    }

    createNotifier() {
        if (!process.env.IMAP_USER || !process.env.IMAP_PASS || !process.env.IMAP_HOST || !process.env.IMAP_PORT) {
            console.error('IMAP environment variables are not set. Check .env configuration.');
            return null;
        }

        try {
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
        } catch (error) {
            console.error('Failed to create MailNotifier instance:', error);
            return null;
        }
    }

    static parseHtmlContent(htmlContent) {
        try {
            const $ = cheerio.load(htmlContent);
            return $('body').text().replace(/\s+/g, ' ').trim();
        } catch (error) {
            console.error('Failed to parse HTML content:', error);
            return null;
        }
    }

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

    startNotifier() {
        try {
            if (this.notifier && this.notifier.running) {
                console.log('Stopping existing notifier...');
                this.notifier.stop();
            } else {
                console.log('Notifier not initialized or not running.');
            }

            this.notifier = this.createNotifier();

            if (!this.notifier) {
                console.error('Failed to initialize MailNotifier. Aborting startup.');
                return;
            }

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
        } catch (error) {
            console.error('Error in startNotifier:', error);
        }
    }

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
        setTimeout(this.startNotifier, this.reconnectDelay);
    }
}

module.exports = new EmailNotifier();
