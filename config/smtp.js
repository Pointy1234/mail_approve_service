const nodemailer = require('nodemailer');
const { smtp } = require('./env');

const getTransportOptions = (port) => {
    return port === 465 ? { secure: true } : { secure: false };
};

const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    ...getTransportOptions(smtp.port),
    auth: {
        user: smtp.user,
        pass: smtp.pass,
    },
});

module.exports = transporter;
