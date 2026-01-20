const express = require('express');
const router = express.Router();
const {
  getAllLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  addNote,
  getStats
} = require('../controllers/leadController');

// All routes are now public (no authentication required)
router.get('/', getAllLeads);
router.get('/stats', getStats);
router.get('/:id', getLead);
router.post('/', createLead);
router.put('/:id', updateLead);
router.delete('/:id', deleteLead);
router.post('/:id/notes', addNote);

module.exports = router;