const { processEmail } = require('../services/imapService');
const { logExternalApiCall } = require('../utils/logger');

exports.processEmails = (req, res) => {
    processEmail(req.body)
        .then(() => res.status(200).json({ status: 'Emails processed successfully' }))
        .catch((error) => res.status(500).json({ status: 'Failed to process emails', error: error.message }));
};
