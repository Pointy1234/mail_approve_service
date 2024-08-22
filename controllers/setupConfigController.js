const { smtp, imap, externalApi } = require('../config/env');
const { logExternalApiCall } = require('../utils/logger');
const fs = require('fs');
const path = require('path');

const updateConfigFile = (newConfig) => {
    const envFilePath = path.join(__dirname, '..', '.env');
    let newEnvContent = '';
    
    for (const [key, value] of Object.entries(newConfig)) {
        newEnvContent += `${key}=${value}\n`;
    }
    
    fs.writeFileSync(envFilePath, newEnvContent, 'utf8');
};

exports.setupConfig = (req, res) => {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASS, EXTERNAL_API_URL, EXTERNAL_API_TOKEN } = req.body;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !IMAP_HOST || !IMAP_PORT || !IMAP_USER || !IMAP_PASS || !EXTERNAL_API_URL || !EXTERNAL_API_TOKEN) {
        return res.status(400).json({ status: 'Invalid configuration parameters' });
    }

    const newConfig = {
        SMTP_HOST,
        SMTP_PORT,
        SMTP_USER,
        SMTP_PASS,
        IMAP_HOST,
        IMAP_PORT,
        IMAP_USER,
        IMAP_PASS,
        EXTERNAL_API_URL,
        EXTERNAL_API_TOKEN
    };

    updateConfigFile(newConfig);

    // Optionally restart IMAP notifier here if it has been initialized
    // const { startNotifier } = require('../services/imapService');
    // startNotifier();

    res.status(200).json({ status: 'Configuration updated successfully' });
};
