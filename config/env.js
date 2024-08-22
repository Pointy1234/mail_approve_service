require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,
    smtp: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10),
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    imap: {
        host: process.env.IMAP_HOST,
        port: parseInt(process.env.IMAP_PORT, 10),
        user: process.env.IMAP_USER,
        pass: process.env.IMAP_PASS,
    },
    externalApi: {
        url: process.env.EXTERNAL_API_URL,
        token: process.env.EXTERNAL_API_TOKEN,
    },
};
