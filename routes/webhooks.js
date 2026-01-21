const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// WhatsApp webhook
if (webhookController.whatsappWebhook) {
  router.post('/whatsapp', webhookController.whatsappWebhook);
}

// Facebook routes
if (webhookController.facebookWebhook) {
  router.get('/facebook', webhookController.facebookWebhook);
  router.post('/facebook', webhookController.facebookWebhook);
}

// Instagram routes
if (webhookController.instagramWebhook) {
  router.get('/instagram', webhookController.instagramWebhook);
  router.post('/instagram', webhookController.instagramWebhook);
}

// Instagram debug route (optional)
if (webhookController.instagramWebhookDebug) {
  router.post('/instagram/debug', webhookController.instagramWebhookDebug);
}

module.exports = router;