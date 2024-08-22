const nodemailer = require('nodemailer');
const { smtp } = require('../config/env');

const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465, // true for 465, false for other ports
    auth: {
        user: smtp.user,
        pass: smtp.pass,
    },
});

module.exports = transporter;
