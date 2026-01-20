const express = require('express');
const router = express.Router();
const {
  whatsappWebhook,
  facebookWebhook,
  instagramWebhook,
  instagramWebhookDebug
} = require('../controllers/webhookController');

// Public routes (no auth required for webhooks)
router.post('/whatsapp', whatsappWebhook);
router.get('/facebook', facebookWebhook);
router.post('/facebook', facebookWebhook);
router.get('/instagram', instagramWebhook);
router.post('/instagram', instagramWebhook);
router.post('/instagram/debug', instagramWebhookDebug);

// Debug endpoints
router.get('/instagram/debug', instagramWebhookDebug);
router.delete('/instagram/debug', clearWebhookLogs);

module.exports = router;