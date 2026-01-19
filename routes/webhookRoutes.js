const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// WhatsApp webhooks
router.get('/whatsapp', webhookController.verifyWhatsApp);
router.post('/whatsapp', webhookController.handleWhatsAppWebhook);

// Instagram webhooks
router.get('/instagram', webhookController.verifyInstagram);
router.post('/instagram', webhookController.handleInstagramWebhook);

// Facebook webhooks
router.get('/facebook', webhookController.verifyFacebook);
router.post('/facebook', webhookController.handleFacebookWebhook);

// Website form submissions
router.post('/website', webhookController.handleWebsiteSubmission);

module.exports = router;