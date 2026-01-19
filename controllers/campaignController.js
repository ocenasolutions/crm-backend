const Campaign = require('../models/Campaign');
const Lead = require('../models/Lead');
const emailService = require('../services/emailService');
const whatsappService = require('../services/whatsappService');
const instagramService = require('../services/instagramService');
const facebookService = require('../services/facebookService');

// Get all campaigns
exports.getAllCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find()
      .sort({ createdAt: -1 });

    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
};

// Get campaign by ID
exports.getCampaignById = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(campaign);
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
};

// Create new campaign
exports.createCampaign = async (req, res) => {
  try {
    const { name, channel, subject, message, targetAudience, scheduledFor } = req.body;

    if (!name || !channel || !message) {
      return res.status(400).json({ 
        error: 'Name, channel, and message are required' 
      });
    }

    const campaign = new Campaign({
      name,
      channel,
      subject,
      message,
      targetAudience,
      scheduledFor,
      status: scheduledFor ? 'scheduled' : 'draft'
    });

    await campaign.save();
    console.log(`✅ Campaign created: ${name} (${channel})`);

    res.status(201).json(campaign);
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
};

// Update campaign
exports.updateCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(campaign);
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
};

// Delete campaign
exports.deleteCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndDelete(req.params.id);

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
};

// Send campaign
exports.sendCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (campaign.status === 'completed') {
      return res.status(400).json({ error: 'Campaign already sent' });
    }

    // Get target leads
    const filter = {};
    if (campaign.targetAudience !== 'all') {
      filter.status = campaign.targetAudience;
    }

    const leads = await Lead.find(filter);

    if (leads.length === 0) {
      return res.status(400).json({ error: 'No leads found for target audience' });
    }

    // Update campaign status
    campaign.status = 'active';
    campaign.sentAt = new Date();
    await campaign.save();

    // Send campaign based on channel
    let sentCount = 0;
    let failedCount = 0;

    for (const lead of leads) {
      try {
        switch (campaign.channel) {
          case 'email':
            if (lead.email) {
              await emailService.sendEmail({
                to: lead.email,
                subject: campaign.subject,
                message: campaign.message,
                leadName: lead.name
              });
              sentCount++;
            }
            break;

          case 'whatsapp':
            if (lead.phone) {
              await whatsappService.sendMessage({
                to: lead.phone,
                message: campaign.message
              });
              sentCount++;
            }
            break;

          case 'instagram':
            if (lead.metadata && lead.metadata.get('instagram_id')) {
              await instagramService.sendMessage({
                recipientId: lead.metadata.get('instagram_id'),
                message: campaign.message
              });
              sentCount++;
            }
            break;

          case 'facebook':
            if (lead.metadata && lead.metadata.get('facebook_id')) {
              await facebookService.sendMessage({
                recipientId: lead.metadata.get('facebook_id'),
                message: campaign.message
              });
              sentCount++;
            }
            break;
        }
      } catch (error) {
        console.error(`Failed to send to ${lead.name}:`, error);
        failedCount++;
      }
    }

    // Update campaign with results
    campaign.sentCount = sentCount;
    campaign.failedCount = failedCount;
    campaign.deliveredCount = sentCount;
    campaign.status = 'completed';
    campaign.completedAt = new Date();
    await campaign.save();

    console.log(`✅ Campaign sent: ${sentCount} successful, ${failedCount} failed`);

    res.json({
      message: 'Campaign sent successfully',
      sentCount,
      failedCount,
      totalLeads: leads.length
    });
  } catch (error) {
    console.error('Error sending campaign:', error);
    res.status(500).json({ error: 'Failed to send campaign' });
  }
};

// Schedule campaign
exports.scheduleCampaign = async (req, res) => {
  try {
    const { scheduledFor } = req.body;
    
    const campaign = await Campaign.findByIdAndUpdate(
      req.params.id,
      { 
        scheduledFor: new Date(scheduledFor),
        status: 'scheduled'
      },
      { new: true }
    );

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(campaign);
  } catch (error) {
    console.error('Error scheduling campaign:', error);
    res.status(500).json({ error: 'Failed to schedule campaign' });
  }
};

// Cancel campaign
exports.cancelCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndUpdate(
      req.params.id,
      { status: 'draft' },
      { new: true }
    );

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(campaign);
  } catch (error) {
    console.error('Error canceling campaign:', error);
    res.status(500).json({ error: 'Failed to cancel campaign' });
  }
};

// Get campaign analytics
exports.getCampaignAnalytics = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const analytics = {
      name: campaign.name,
      channel: campaign.channel,
      status: campaign.status,
      sent: campaign.sentCount,
      delivered: campaign.deliveredCount,
      failed: campaign.failedCount,
      opened: campaign.openedCount,
      clicked: campaign.clickedCount,
      deliveryRate: campaign.sentCount > 0 
        ? ((campaign.deliveredCount / campaign.sentCount) * 100).toFixed(2) 
        : 0,
      openRate: campaign.deliveredCount > 0 
        ? ((campaign.openedCount / campaign.deliveredCount) * 100).toFixed(2) 
        : 0,
      clickRate: campaign.openedCount > 0 
        ? ((campaign.clickedCount / campaign.openedCount) * 100).toFixed(2) 
        : 0
    };

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};