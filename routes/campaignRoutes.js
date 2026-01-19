const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');

// Campaign CRUD operations
router.get('/', campaignController.getAllCampaigns);
router.get('/:id', campaignController.getCampaignById);
router.post('/', campaignController.createCampaign);
router.put('/:id', campaignController.updateCampaign);
router.delete('/:id', campaignController.deleteCampaign);

// Campaign actions
router.post('/:id/send', campaignController.sendCampaign);
router.post('/:id/schedule', campaignController.scheduleCampaign);
router.post('/:id/cancel', campaignController.cancelCampaign);

// Campaign analytics
router.get('/:id/analytics', campaignController.getCampaignAnalytics);

module.exports = router;