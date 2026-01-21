// routes/whatsapp.js - NEW FILE
const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

// Webhook routes - BOTH GET and POST
router.get('/webhook', whatsappController.whatsappWebhook);
router.post('/webhook', whatsappController.whatsappWebhook);

// Messaging routes
router.post('/send/:id', whatsappController.sendMessageToLead);
router.post('/broadcast', whatsappController.broadcastMessage);
router.post('/test', whatsappController.testWhatsAppMessage);

module.exports = router;