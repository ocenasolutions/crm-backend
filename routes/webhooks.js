const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// Instagram routes - BOTH GET and POST
router.get('/instagram', webhookController.instagramWebhook);
router.post('/instagram', webhookController.instagramWebhook);

// Facebook routes - BOTH GET and POST
router.get('/facebook', webhookController.facebookWebhook);
router.post('/facebook', webhookController.facebookWebhook);

// WhatsApp webhook
router.post('/whatsapp', webhookController.whatsappWebhook);

// Instagram debug route
router.post('/instagram/debug', webhookController.instagramWebhookDebug);

module.exports = router;