const nodemailer = require('nodemailer');
const axios = require('axios');
const mime = require('mime');
const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html');
const { validationResult, checkSchema } = require('express-validator');

// Конфигурация транспортера
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true', // true для 465, false для других портов
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
});

// Валидация входных данных
const validateEmailRequest = checkSchema({
    recipient: {
        in: ['body'],
        isEmail: true,
        errorMessage: 'Recipient email is required and should be valid.',
    },
    subject: {
        in: ['body'],
        optional: true,
        isString: true,
        errorMessage: 'Subject should be a valid string.',
    },
    mainText: {
        in: ['body'],
        isString: true,
        errorMessage: 'Main text is required.',
    },
    download_urls: {
        in: ['body'],
        optional: true,
        isArray: true,
        errorMessage: 'Download URLs should be an array.',
    },
});

// Очистка HTML
const sanitizeOptions = {
    allowedTags: ['p', 'ul', 'li', 'a', 'b', 'i', 'strong', 'em', 'br', 'span'],
    allowedAttributes: {
        a: ['href', 'style'],
        span: ['style'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
};

// Функция для загрузки файлов
const downloadFile = async (url) => {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const contentType = response.headers['content-type'];
        const fileExtension = mime.extension(contentType) || 'dat';
        const fileName = `file_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${fileExtension}`;
        const fileBuffer = Buffer.from(response.data, 'binary');

        return { filename: fileName, content: fileBuffer };
    } catch (error) {
        console.error(`Error downloading file from ${url}: ${error.message}`);
        throw new Error(`Failed to download file: ${url}`);
    }
};

// Основная функция отправки email
exports.sendEmail = [
    validateEmailRequest,
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { recipient, subject, mainText, download_urls } = req.body;

        try {
            // Очистка входных данных
            const sanitizedSubject = sanitizeHtml(subject || 'Уведомление', sanitizeOptions);
            const sanitizedMainText = sanitizeHtml(mainText, sanitizeOptions);

            // Параллельная загрузка файлов
            const attachments = download_urls
                ? await Promise.all(download_urls.map((url) => downloadFile(url)))
                : [];

            // Генерация mailOptions
            const mailOptions = {
                from: process.env.SMTP_USER,
                to: recipient,
                subject: sanitizedSubject,
                html: sanitizedMainText,
                attachments,
            };

            // Отправка email
            await transporter.sendMail(mailOptions);
            res.status(200).json({ status: 'Email sent successfully' });
        } catch (error) {
            console.error('Error sending email:', error.message);
            res.status(500).json({ status: 'Failed to send email', error: error.message });
        }
    },
];

// Функция отправки email о закрытии задачи
exports.sendTaskClosureEmail = async (req, res) => {
    try {
        const { to, text } = req.body;

        if (!to || !text) {
            throw new Error('Missing required fields: "to" and "text".');
        }

        const sanitizedText = sanitizeHtml(text, sanitizeOptions);

        const mailOptions = {
            from: process.env.SMTP_USER,
            to,
            subject: 'Закрытие задачи',
            text: sanitizedText,
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ status: 'Task closure email sent successfully' });
    } catch (error) {
        console.error('Error sending task closure email:', error.message);
        res.status(500).json({ status: 'Failed to send task closure email', error: error.message });
    }
};
