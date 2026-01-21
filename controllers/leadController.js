const Lead = require('../models/Lead');

// Get all leads with enhanced filtering
exports.getAllLeads = async (req, res) => {
  try {
    const { platform, status, qualification, search, interactionType, isFollower } = req.query;
    const query = {};

    if (platform && platform !== 'all') query.platform = platform;
    if (status && status !== 'all') query.status = status;
    if (qualification && qualification !== 'all') query.qualification = qualification;
    if (interactionType && interactionType !== 'all') query.interactionType = interactionType;
    if (isFollower === 'true') query.isFollower = true;
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    const leads = await Lead.find(query)
      .populate('assignedTo', 'name email')
      .sort({ lastInteractionAt: -1, createdAt: -1 });

    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Instagram-specific stats
exports.getInstagramStats = async (req, res) => {
  try {
    const totalMessages = await Lead.countDocuments({ 
      platform: 'instagram',
      interactionType: 'message'
    });
    
    const totalFollowers = await Lead.countDocuments({ 
      platform: 'instagram',
      isFollower: true
    });
    
    const totalComments = await Lead.countDocuments({ 
      platform: 'instagram',
      hasCommented: true
    });
    
    const totalMentions = await Lead.countDocuments({ 
      platform: 'instagram',
      hasMentioned: true
    });

    const recentInteractions = await Lead.find({
      platform: 'instagram',
      lastInteractionAt: { $exists: true }
    })
    .sort({ lastInteractionAt: -1 })
    .limit(10)
    .select('name interactionType lastInteractionAt message');

    const interactionsByType = await Lead.aggregate([
      { $match: { platform: 'instagram' } },
      { $group: { _id: '$interactionType', count: { $sum: 1 } } }
    ]);

    res.json({
      totalMessages,
      totalFollowers,
      totalComments,
      totalMentions,
      recentInteractions,
      interactionsByType
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single lead
exports.getLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate('notes.createdBy', 'name');

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create lead
exports.createLead = async (req, res) => {
  try {
    const lead = new Lead(req.body);
    await lead.save();
    res.status(201).json(lead);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update lead
exports.updateLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
};

// Add note to lead
exports.addNote = async (req, res) => {
  try {
    const { text } = req.body;
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    lead.notes.push({
      text,
      createdBy: req.userId
    });

    await lead.save();
    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get overall stats
exports.getStats = async (req, res) => {
  try {
    const total = await Lead.countDocuments();
    const hot = await Lead.countDocuments({ qualification: 'hot' });
    const warm = await Lead.countDocuments({ qualification: 'warm' });
    const cold = await Lead.countDocuments({ qualification: 'cold' });
    
    const byPlatform = await Lead.aggregate([
      { $group: { _id: '$platform', count: { $sum: 1 } } }
    ]);

    const byStatus = await Lead.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const byInteractionType = await Lead.aggregate([
      { 
        $match: { 
          platform: 'instagram',
          interactionType: { $exists: true }
        } 
      },
      { $group: { _id: '$interactionType', count: { $sum: 1 } } }
    ]);

    res.json({
      total,
      qualification: { hot, warm, cold },
      byPlatform,
      byStatus,
      byInteractionType
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};