const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { logger } = require('../utils/logger');

const envPath = path.resolve(__dirname, '../.env');

// Функция проверки конфигурации
const validateConfig = (req, res, next) => {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASS, EXTERNAL_API_URL, EXTERNAL_API_TOKEN } = req.body;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !IMAP_HOST || !IMAP_PORT || !IMAP_USER || !IMAP_PASS || !EXTERNAL_API_URL || !EXTERNAL_API_TOKEN) {
        return res.status(400).json({ status: 'Invalid configuration', message: 'All configuration fields are required' });
    }
    next();
};

// Функция обновления конфигурации
const updateConfig = (req, res) => {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASS, EXTERNAL_API_URL, EXTERNAL_API_TOKEN } = req.body;

    const newEnvContent = `
    PORT=${process.env.PORT || 3000}
    SMTP_HOST=${SMTP_HOST}
    SMTP_PORT=${SMTP_PORT}
    SMTP_USER=${SMTP_USER}
    SMTP_PASS=${SMTP_PASS}
    IMAP_HOST=${IMAP_HOST}
    IMAP_PORT=${IMAP_PORT}
    IMAP_USER=${IMAP_USER}
    IMAP_PASS=${IMAP_PASS}
    EXTERNAL_API_URL=${EXTERNAL_API_URL}
    EXTERNAL_API_TOKEN=${EXTERNAL_API_TOKEN}
    `;

    fs.writeFile(envPath, newEnvContent, (err) => {
        if (err) {
            logger.error('Failed to update .env file:', { error: err.message });
            return res.status(500).json({ status: 'Failed to update configuration', error: err.message });
        }
        dotenv.config({ path: envPath });
        logger.info('Configuration updated successfully');
        res.status(200).json({ status: 'Configuration updated successfully' });
    });
};

module.exports = {
    validateConfig,
    updateConfig
};
