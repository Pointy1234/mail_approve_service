const transporter = require('../config/smtp');
const { logExternalApiCall } = require('../utils/logger');

exports.sendEmail = async (req, res) => {
    try {
        const { recipient, type, register_number, comment, status, content, initiator, department, creation_date, id } = req.body;

        if (!recipient || !type || !register_number || !status || !content || !initiator || !department || !creation_date || !id) {
            throw new Error('Missing required fields');
        }

        const mailOptions = {
            from: process.env.SMTP_USER,
            to: recipient,
            subject: `Требуется Ваше согласование ${type} ${register_number}`,
            html: `
                <p>Требуется Ваше согласование ${type} ${register_number}</p>
                <p>Комментарий: ${comment || 'не указан'}</p>
                <p>Текущий статус: ${status}</p>
                <p>Краткая информация по документу:</p>
                <ul>
                    <li>Регистрационный номер: ${register_number}</li>
                    <li>Вид документа: ${type}</li>
                    <li>Инициатор: ${initiator}</li>
                    <li>Подразделение: ${department}</li>
                    <li>Содержание: ${content}</li>
                    <li>Дата создания: ${new Date(creation_date).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</li>
                </ul>
                <p>
                    <a href="mailto:${process.env.SMTP_USER}?subject=Согласование&body=Документ ${type} ${register_number} согласован. id=${id} approved=true"
                       style="background-color: #add8e6; color: black; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                       Согласовать
                    </a>
                </p>
                <p>
                    <a href="mailto:${process.env.SMTP_USER}?subject=Замечания по документу&body=Документ ${type} ${register_number} требует доработок. id=${id} approved=false"
                       style="background-color: #add8e6; color: black; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                       Отправить замечания Инициатору
                    </a>
                </p>
            `
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ status: 'Email sent successfully' });
    } catch (error) {
        res.status(500).json({ status: 'Failed to send email', error: error.message });
    }
};

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