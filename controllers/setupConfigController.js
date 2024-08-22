const fs = require('fs');
const path = require('path');

// Обновление конфигурационного файла .env
const updateConfigFile = (newConfig) => {
    const envFilePath = path.join(__dirname, '..', '.env');
    let newEnvContent = '';

    for (const [key, value] of Object.entries(newConfig)) {
        newEnvContent += `${key}=${value}\n`;
    }

    fs.writeFileSync(envFilePath, newEnvContent, 'utf8');
};

exports.setupConfig = (req, res) => {
    const { 
        SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
        IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASS,
        EXTERNAL_API_URL, EXTERNAL_API_TOKEN, NODE_TLS_REJECT_UNAUTHORIZED
    } = req.body;

    // Проверка обязательных параметров
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS ||
        !IMAP_HOST || !IMAP_PORT || !IMAP_USER || !IMAP_PASS ||
        !EXTERNAL_API_URL || !EXTERNAL_API_TOKEN) {
        return res.status(400).json({ status: 'Invalid configuration parameters' });
    }

    // Создание нового объекта конфигурации
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
        EXTERNAL_API_TOKEN,
        NODE_TLS_REJECT_UNAUTHORIZED: NODE_TLS_REJECT_UNAUTHORIZED || '1' // Значение по умолчанию
    };

    // Обновление файла конфигурации
    updateConfigFile(newConfig);

    // Обновление переменной окружения в текущем процессе
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = newConfig.NODE_TLS_REJECT_UNAUTHORIZED;

    res.status(200).json({ status: 'Configuration updated successfully' });
};
