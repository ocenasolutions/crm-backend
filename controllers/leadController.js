const Lead = require('../models/Lead');

// Get all leads with filtering and pagination
exports.getAllLeads = async (req, res) => {
  try {
    const { source, status, page = 1, limit = 50 } = req.query;
    
    const filter = {};
    if (source) filter.source = source;
    if (status) filter.status = status;

    const leads = await Lead.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Lead.countDocuments(filter);

    res.json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
};

// Get single lead by ID
exports.getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json(lead);
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
};

// Create new lead
exports.createLead = async (req, res) => {
  try {
    const { name, email, phone, source, message, metadata } = req.body;

    // Validate required fields
    if (!name || !source) {
      return res.status(400).json({ 
        error: 'Name and source are required' 
      });
    }

    const lead = new Lead({
      name,
      email,
      phone,
      source,
      message,
      metadata,
      status: 'new'
    });

    await lead.save();
    console.log(`✅ New lead created: ${name} from ${source}`);

    res.status(201).json(lead);
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
};

// Update lead
exports.updateLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { ...req.body, lastContactedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json(lead);
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
};

// Delete lead
exports.deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
};

// Get lead statistics
exports.getLeadStats = async (req, res) => {
  try {
    const stats = await Lead.aggregate([
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusStats = await Lead.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      bySource: stats,
      byStatus: statusStats,
      total: await Lead.countDocuments()
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};

// Bulk import leads
exports.bulkImportLeads = async (req, res) => {
  try {
    const { leads } = req.body;

    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: 'Invalid leads data' });
    }

    const result = await Lead.insertMany(leads, { ordered: false });
    
    res.json({
      message: 'Leads imported successfully',
      imported: result.length
    });
  } catch (error) {
    console.error('Error importing leads:', error);
    res.status(500).json({ error: 'Failed to import leads' });
  }
};