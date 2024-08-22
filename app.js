const express = require('express');
const { logger } = require('./utils/logger');
const { startNotifier } = require('./services/imapService');
const { sendEmail, sendTaskClosureEmail } = require('./controllers/emailController');
const { processEmails } = require('./controllers/imapController');
const { setupConfig } = require('./controllers/setupConfigController');

const app = express();

app.use(express.json());

// Routes
app.post('/send-email', sendEmail);
app.post('/send-task-closure-email', sendTaskClosureEmail);
app.post('/process-emails', processEmails);
app.post('/setup-config', setupConfig);

// Health check routes
app.get('/liveness', (req, res) => {
    res.status(200).json({ status: 'Service is alive' });
});

app.get('/readiness', async (req, res) => {
    try {
        res.status(200).json({ status: 'Service is ready' });
    } catch (error) {
        logger.error('Readiness check failed:', { error });
        res.status(500).json({ status: 'Service is not ready', error: error.message });
    }
});

// Start IMAP notifier
startNotifier();

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
});
