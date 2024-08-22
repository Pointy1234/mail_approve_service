const transporter = require('../config/smtp');

exports.sendTaskClosureEmail = async (req, res) => {
    try {
        const { to, text } = req.body;

        if (!to || !text) {
            throw new Error('Missing required fields: "to" and "text"');
        }

        const mailOptions = {
            from: process.env.SMTP_USER,
            to,
            subject: 'Закрытие задачи',
            text,
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ status: 'Task closure email sent successfully' });
    } catch (error) {
        res.status(500).json({ status: 'Failed to send task closure email', error: error.message });
    }
};
