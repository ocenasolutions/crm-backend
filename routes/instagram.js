// routes/instagram.js - NEW FILE
const express = require('express');
const router = express.Router();
const instagramController = require('../controllers/instagramController');

// Messaging routes
router.post('/send/:id', instagramController.sendMessageToLead);
router.post('/broadcast', instagramController.broadcastMessage);
router.post('/test', instagramController.testInstagramMessage);

module.exports = router;