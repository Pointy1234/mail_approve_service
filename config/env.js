require('dotenv').config();
const defaultConfig = {
    port: 3000,
    smtp: {
        host: 'smtp.example.com',
        port: 465,
        user: 'user@example.com',
        pass: 'password',
    },
    imap: {
        host: 'imap.example.com',
        port: 993,
        user: 'user@example.com',
        pass: 'password',
    },
    externalApi: {
        url: 'https://api.example.com',
        token: 'your_api_token',
    },
};

module.exports = {
    port: process.env.PORT || defaultConfig.port,
    smtp: {
        host: process.env.SMTP_HOST || defaultConfig.smtp.host,
        port: parseInt(process.env.SMTP_PORT, 10) || defaultConfig.smtp.port,
        user: process.env.SMTP_USER || defaultConfig.smtp.user,
        pass: process.env.SMTP_PASS || defaultConfig.smtp.pass,
    },
    imap: {
        host: process.env.IMAP_HOST || defaultConfig.imap.host,
        port: parseInt(process.env.IMAP_PORT, 10) || defaultConfig.imap.port,
        user: process.env.IMAP_USER || defaultConfig.imap.user,
        pass: process.env.IMAP_PASS || defaultConfig.imap.pass,
    },
    externalApi: {
        url: process.env.EXTERNAL_API_URL || defaultConfig.externalApi.url,
        token: process.env.EXTERNAL_API_TOKEN || defaultConfig.externalApi.token,
    },
};
