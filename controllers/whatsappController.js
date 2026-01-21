// controllers/whatsappController.js
const Lead = require('../models/Lead');
const axios = require('axios');

// Send WhatsApp message using Meta Cloud API
const sendWhatsAppMessage = async (phoneNumber, message) => {
  try {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    
    if (!accessToken || !phoneNumberId) {
      console.error('❌ WhatsApp credentials not configured');
      return { success: false, error: 'Missing credentials' };
    }

    // Clean phone number - remove any non-numeric characters
    let cleanPhone = phoneNumber.replace(/\D/g, '');
    
    // If phone doesn't have country code, assume India (+91)
    if (!cleanPhone.startsWith('91') && cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    console.log(`📤 Sending WhatsApp message to: +${cleanPhone}`);

    const response = await axios.post(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'text',
        text: {
          body: message
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ WhatsApp message sent successfully');
    console.log('Response:', response.data);
    
    return { 
      success: true, 
      messageId: response.data.messages[0].id,
      data: response.data 
    };
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:');
    console.error('Status:', error.response?.status);
    console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    
    return { 
      success: false, 
      error: error.response?.data || error.message 
    };
  }
};

// Send WhatsApp template message (for approved templates)
const sendWhatsAppTemplate = async (phoneNumber, templateName, languageCode = 'en') => {
  try {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    
    let cleanPhone = phoneNumber.replace(/\D/g, '');
    if (!cleanPhone.startsWith('91') && cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    console.log(`📤 Sending WhatsApp template "${templateName}" to: +${cleanPhone}`);

    const response = await axios.post(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode
          }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ WhatsApp template sent successfully');
    
    return { 
      success: true, 
      messageId: response.data.messages[0].id,
      data: response.data 
    };
  } catch (error) {
    console.error('❌ Error sending WhatsApp template:');
    console.error('Status:', error.response?.status);
    console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    
    return { 
      success: false, 
      error: error.response?.data || error.message 
    };
  }
};

// WhatsApp Webhook Handler
exports.whatsappWebhook = async (req, res) => {
  try {
    // ==========================================
    // WEBHOOK VERIFICATION (GET REQUEST)
    // ==========================================
    if (req.method === 'GET') {
      console.log('🔍 WhatsApp webhook VERIFICATION request');
      
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      
      if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        console.log('✅ WHATSAPP WEBHOOK_VERIFIED');
        return res.status(200).send(challenge);
      } else {
        console.log('❌ WhatsApp verification failed');
        return res.sendStatus(403);
      }
    }
    
    // ==========================================
    // WEBHOOK EVENTS (POST REQUEST)
    // ==========================================
    console.log('=== WHATSAPP WEBHOOK EVENT ===');
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('==============================');
    
    const { entry } = req.body;
    
    if (!entry || !entry[0]?.changes) {
      console.log('⚠️ No valid entry data in webhook');
      return res.status(200).send('EVENT_RECEIVED');
    }

    for (const item of entry) {
      const changes = item.changes;
      
      for (const change of changes) {
        if (change.field === 'messages') {
          const value = change.value;
          
          // Extract message details
          const messages = value.messages;
          const contacts = value.contacts;
          
          if (!messages || messages.length === 0) {
            console.log('⚠️ No messages in webhook');
            continue;
          }

          for (const message of messages) {
            const phoneNumber = message.from;
            const messageId = message.id;
            const messageType = message.type;
            const timestamp = message.timestamp;
            
            // Get contact name
            const contact = contacts?.find(c => c.wa_id === phoneNumber);
            const contactName = contact?.profile?.name || 'Unknown';
            
            // Extract message text
            let messageText = '';
            if (messageType === 'text') {
              messageText = message.text?.body || '';
            } else if (messageType === 'button') {
              messageText = message.button?.text || 'Button clicked';
            } else if (messageType === 'interactive') {
              messageText = message.interactive?.button_reply?.title || 
                           message.interactive?.list_reply?.title || 
                           'Interactive response';
            } else {
              messageText = `[${messageType} message]`;
            }

            console.log('📱 WhatsApp message:', {
              from: phoneNumber,
              name: contactName,
              text: messageText,
              type: messageType
            });

            // Check if lead exists
            let lead = await Lead.findOne({
              platform: 'whatsapp',
              $or: [
                { platformId: phoneNumber },
                { phone: phoneNumber },
                { phone: phoneNumber.replace(/\D/g, '') }
              ]
            });

            if (lead) {
              // Update existing lead
              lead.message = messageText;
              lead.lastInteractionAt = new Date();
              lead.interactionCount = (lead.interactionCount || 0) + 1;
              lead.notes.push({
                text: `New message: ${messageText}`,
                createdAt: new Date()
              });
              console.log('🔄 Updating existing lead:', lead._id);
            } else {
              // Create new lead
              lead = new Lead({
                name: contactName,
                phone: phoneNumber,
                platform: 'whatsapp',
                platformId: phoneNumber,
                message: messageText,
                status: 'new',
                qualification: 'cold',
                interactionType: 'message',
                interactionCount: 1,
                lastInteractionAt: new Date()
              });
              console.log('✨ Creating new lead');
            }

            await lead.save();
            console.log('✅ WhatsApp lead saved:', lead._id);

            // Send auto-reply
            const autoReplyMessage = process.env.WHATSAPP_AUTO_REPLY_MESSAGE || 
              "Thank you for contacting us! 🙏 We've received your message and will get back to you soon.";
            
            const result = await sendWhatsAppMessage(phoneNumber, autoReplyMessage);
            
            if (result.success) {
              lead.autoReplySent = true;
              await lead.save();
            }
          }

          // Handle status updates (delivered, read, sent)
          const statuses = value.statuses;
          if (statuses && statuses.length > 0) {
            for (const status of statuses) {
              console.log('📊 Message status update:', {
                id: status.id,
                status: status.status,
                recipient: status.recipient_id
              });
              // You can track message delivery status here if needed
            }
          }
        }
      }
    }

    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error('❌ WhatsApp webhook error:', error);
    console.error('Error stack:', error.stack);
    // Still return 200 to prevent Meta from disabling webhook
    res.status(200).send('EVENT_RECEIVED');
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

    if (!lead.phone) {
      return res.status(400).json({ error: 'Lead has no phone number' });
    }

    let result;
    
    if (useTemplate && templateName) {
      // Send template message
      result = await sendWhatsAppTemplate(lead.phone, templateName);
    } else if (message) {
      // Send regular text message
      result = await sendWhatsAppMessage(lead.phone, message);
    } else {
      return res.status(400).json({ error: 'No message or template provided' });
    }

    if (result.success) {
      // Update lead
      lead.notes.push({
        text: `Sent WhatsApp message: ${message || `Template: ${templateName}`}`,
        createdAt: new Date()
      });
      lead.lastInteractionAt = new Date();
      lead.interactionCount = (lead.interactionCount || 0) + 1;
      lead.status = 'contacted';
      
      await lead.save();
      
      return res.json({
        success: true,
        message: 'WhatsApp message sent successfully',
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
    const { message, leadIds, filters, useTemplate, templateName } = req.body;

    let leads = [];

    if (leadIds && leadIds.length > 0) {
      // Send to specific leads
      leads = await Lead.find({ _id: { $in: leadIds } });
    } else if (filters) {
      // Send based on filters
      const query = { platform: 'whatsapp' };
      
      if (filters.status) query.status = filters.status;
      if (filters.qualification) query.qualification = filters.qualification;
      
      leads = await Lead.find(query);
    } else {
      return res.status(400).json({ error: 'No leads specified' });
    }

    // Filter leads that have phone numbers
    leads = leads.filter(lead => lead.phone);

    if (leads.length === 0) {
      return res.status(400).json({ error: 'No valid leads found' });
    }

    console.log(`📢 Broadcasting to ${leads.length} leads`);

    const results = [];
    
    for (const lead of leads) {
      let result;
      
      if (useTemplate && templateName) {
        result = await sendWhatsAppTemplate(lead.phone, templateName);
      } else {
        result = await sendWhatsAppMessage(lead.phone, message);
      }
      
      results.push({
        leadId: lead._id,
        name: lead.name,
        phone: lead.phone,
        success: result.success,
        error: result.error
      });

      if (result.success) {
        lead.notes.push({
          text: `Broadcast message sent: ${message || `Template: ${templateName}`}`,
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

// Test WhatsApp message
exports.testWhatsAppMessage = async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const testMessage = message || 'This is a test message from your CRM system. ✅';
    
    const result = await sendWhatsAppMessage(phoneNumber, testMessage);
    
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
  whatsappWebhook: exports.whatsappWebhook,
  sendMessageToLead: exports.sendMessageToLead,
  broadcastMessage: exports.broadcastMessage,
  testWhatsAppMessage: exports.testWhatsAppMessage,
  sendWhatsAppMessage 
};