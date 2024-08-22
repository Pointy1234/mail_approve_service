const nodemailer = require('nodemailer');
const { smtp } = require('../config/env');

const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: {
        user: smtp.user,
        pass: smtp.pass,
    },
});

module.exports = transporter;
