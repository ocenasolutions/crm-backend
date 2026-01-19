const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');

// Lead CRUD operations
router.get('/', leadController.getAllLeads);
router.get('/:id', leadController.getLeadById);
router.post('/', leadController.createLead);
router.put('/:id', leadController.updateLead);
router.delete('/:id', leadController.deleteLead);

// Lead statistics
router.get('/stats/overview', leadController.getLeadStats);

// Bulk operations
router.post('/bulk/import', leadController.bulkImportLeads);

module.exports = router;