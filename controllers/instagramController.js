// controllers/instagramController.js
const Lead = require('../models/Lead');
const axios = require('axios');

// Send Instagram message using Meta Graph API
const sendInstagramMessage = async (recipientId, message) => {
  try {
    const igUserId = process.env.IG_USER_ID;
    const accessToken = process.env.IG_ACCESS_TOKEN;
    
    if (!igUserId || !accessToken) {
      console.error('❌ Instagram credentials not configured');
      return { success: false, error: 'Missing credentials' };
    }

    console.log(`📤 Sending Instagram message to: ${recipientId}`);

    const response = await axios.post(
      `https://graph.instagram.com/v21.0/${igUserId}/messages`,
      {
        recipient: { id: recipientId },
        message: { text: message }
      },
      {
        params: {
          access_token: accessToken
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Instagram message sent successfully');
    console.log('Response:', response.data);
    
    return { 
      success: true, 
      messageId: response.data.message_id,
      data: response.data 
    };
  } catch (error) {
    console.error('❌ Error sending Instagram message:');
    console.error('Status:', error.response?.status);
    console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    
    return { 
      success: false, 
      error: error.response?.data || error.message 
    };
  }
};

// Send message to a lead by ID
exports.sendMessageToLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, useTemplate, templateName } = req.body;

    const lead = await Lead.findById(id);
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (!lead.platformId) {
      return res.status(400).json({ error: 'Lead has no Instagram ID' });
    }

    if (!message) {
      return res.status(400).json({ error: 'No message provided' });
    }

    const result = await sendInstagramMessage(lead.platformId, message);

    if (result.success) {
      // Update lead
      lead.notes.push({
        text: `Sent Instagram message: ${message}`,
        createdAt: new Date()
      });
      lead.lastInteractionAt = new Date();
      lead.interactionCount = (lead.interactionCount || 0) + 1;
      lead.status = 'contacted';
      
      await lead.save();
      
      return res.json({
        success: true,
        message: 'Instagram message sent successfully',
        messageId: result.messageId,
        lead: lead
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error sending message to lead:', error);
    res.status(500).json({ error: error.message });
  }
};

// Broadcast message to multiple leads
exports.broadcastMessage = async (req, res) => {
  try {
    const { message, leadIds, filters } = req.body;

    let leads = [];

    if (leadIds && leadIds.length > 0) {
      // Send to specific leads
      leads = await Lead.find({ _id: { $in: leadIds } });
    } else if (filters) {
      // Send based on filters
      const query = { platform: 'instagram' };
      
      if (filters.status) query.status = filters.status;
      if (filters.qualification) query.qualification = filters.qualification;
      if (filters.interactionType) query.interactionType = filters.interactionType;
      
      leads = await Lead.find(query);
    } else {
      return res.status(400).json({ error: 'No leads specified' });
    }

    // Filter leads that have Instagram IDs
    leads = leads.filter(lead => lead.platformId);

    if (leads.length === 0) {
      return res.status(400).json({ error: 'No valid leads found' });
    }

    console.log(`📢 Broadcasting to ${leads.length} Instagram leads`);

    const results = [];
    
    for (const lead of leads) {
      const result = await sendInstagramMessage(lead.platformId, message);
      
      results.push({
        leadId: lead._id,
        name: lead.name,
        platformId: lead.platformId,
        success: result.success,
        error: result.error
      });

      if (result.success) {
        lead.notes.push({
          text: `Broadcast message sent: ${message}`,
          createdAt: new Date()
        });
        lead.lastInteractionAt = new Date();
        lead.interactionCount = (lead.interactionCount || 0) + 1;
        await lead.save();
      }

      // Add delay between messages to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Broadcast completed: ${successCount} sent, ${failCount} failed`,
      total: leads.length,
      successCount,
      failCount,
      results
    });
  } catch (error) {
    console.error('Error broadcasting message:', error);
    res.status(500).json({ error: error.message });
  }
};

// Test Instagram message
exports.testInstagramMessage = async (req, res) => {
  try {
    const { recipientId, message } = req.body;

    if (!recipientId) {
      return res.status(400).json({ error: 'Recipient ID is required' });
    }

    const testMessage = message || 'This is a test message from your CRM system. ✅';
    
    const result = await sendInstagramMessage(recipientId, testMessage);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Test message sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error sending test message:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  sendMessageToLead: exports.sendMessageToLead,
  broadcastMessage: exports.broadcastMessage,
  testInstagramMessage: exports.testInstagramMessage,
  sendInstagramMessage
};