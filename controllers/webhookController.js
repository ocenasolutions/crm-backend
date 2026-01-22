// controllers/webhookController.js
const Lead = require('../models/Lead');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Store to track recent webhook entries (in-memory cache)
const recentWebhooks = new Map();



// Enhanced logging function
const logWebhookData = (data) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...data
  };
  
  console.log('=== WEBHOOK LOG ===');
  console.log(JSON.stringify(logEntry, null, 2));
  console.log('==================');
  
  try {
    const logFile = path.join(__dirname, '../webhook-logs.json');
    const logs = [];
    
    if (fs.existsSync(logFile)) {
      const existing = fs.readFileSync(logFile, 'utf8');
      try {
        logs.push(...JSON.parse(existing));
      } catch (e) {
        // Invalid JSON, start fresh
      }
    }
    
    logs.push(logEntry);
    if (logs.length > 100) logs.shift();
    
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error('Failed to write log file:', err);
  }
};

// Helper: Fetch actual message content using Graph API
// This fixes the "message_edit" ghost event issue
const fetchMessageContent = async (messageId) => {
  try {
    const accessToken = "EAAceqxEyETIBQqU3Rf7fn1rynqKeV0DImGaIefoqHsmbJ9OkFemQN6Tz1GFeyLJjuyt8IZA8ZAMoZBh7ZAZCZB7FrncDnbZCHFikGEeemvhV9yp4B4N5wAeb8KDWsZC7Cg2tBZA7ZAAGMo0YzFdFtGlNT3sYh2SZAZBgpV7Sv6Gq3vMBc3PnGMmeOnZAcyWHJMkDCVQmiHVN5Hz8R7Msj45hNLY9W";
    if (!accessToken) throw new Error('IG_ACCESS_TOKEN not configured');

    console.log(`🔍 Fetching missing content for message ID: ${messageId}`);

    const url = `https://graph.facebook.com/v21.0/${messageId}`;
    const response = await axios.get(url, {
      params: {
        fields: 'message,from,created_time',
        access_token: accessToken
      }
    });

    if (response.data && response.data.message) {
      console.log('✅ Successfully retrieved message content');
      return {
        text: response.data.message,
        senderId: response.data.from?.id,
        senderName: response.data.from?.username || response.data.from?.name
      };
    }
    return null;
  } catch (error) {
    console.error('❌ Failed to fetch message content:', error.response?.data || error.message);
    return null;
  }
};

// Send Instagram message using Meta Graph API
const sendInstagramMessage = async (recipientId, message) => {
  try {
    const accessToken = process.env.IG_ACCESS_TOKEN;
    
    if (!accessToken) {
      console.error('❌ IG_ACCESS_TOKEN not configured');
      return { success: false, error: 'IG_ACCESS_TOKEN not configured' };
    }

    console.log(`📤 Sending Instagram message to: ${recipientId}`);
    
    const url = `https://graph.instagram.com/v21.0/me/messages`;
    const payload = {
      recipient: { id: recipientId },
      message: { text: message }
    };

    const response = await axios.post(url, payload, {
      params: { access_token: accessToken },
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ Instagram message sent successfully');
    
    logWebhookData({
      action: 'sendInstagramMessage_success',
      recipientId,
      response: response.data
    });
    
    return { 
      success: true, 
      messageId: response.data.message_id,
      data: response.data 
    };
  } catch (error) {
    console.error('❌ Error sending Instagram message:', error.response?.data || error.message);
    
    logWebhookData({
      action: 'sendInstagramMessage_error',
      recipientId,
      error: error.response?.data || error.message
    });
    
    return { 
      success: false, 
      error: error.response?.data || error.message 
    };
  }
};

// Instagram Webhook
exports.instagramWebhook = async (req, res) => {
  try {
    // ==========================================
    // WEBHOOK VERIFICATION (GET REQUEST)
    // ==========================================
    if (req.method === 'GET') {
      console.log('🔐 Instagram webhook VERIFICATION request received');
      
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      
      if (mode && token) {
        if (mode === 'subscribe' && token === process.env.IG_VERIFY_TOKEN) {
          console.log('✅ WEBHOOK_VERIFIED');
          return res.status(200).send(challenge);
        } else {
          console.log('❌ Verification token mismatch');
          return res.sendStatus(403);
        }
      }
      return res.sendStatus(400);
    }
    
    // ==========================================
    // WEBHOOK EVENTS (POST REQUEST)
    // ==========================================
    const { entry, object } = req.body;
    
    logWebhookData({
      type: 'webhook_event',
      object,
      entryCount: entry?.length || 0,
      rawBody: req.body
    });

    if (!entry || entry.length === 0) {
      return res.status(200).send('EVENT_RECEIVED');
    }

    for (const item of entry) {
      const entryId = item.id;
      
      // 1. Handle MESSAGES in CHANGES array (NEW Format)
      if (item.changes && Array.isArray(item.changes)) {
        for (const change of item.changes) {
          if (change.field === 'messages' && change.value) {
            const senderId = change.value.sender?.id;
            const messageText = change.value.message?.text;
            const messageId = change.value.message?.mid;

            if (senderId && messageText) {
              await processMessage(senderId, messageText, messageId, entryId);
            }
          }
        }
      }

      // 2. Handle MESSAGES in MESSAGING array (LEGACY/Standard Format)
      if (item.messaging && Array.isArray(item.messaging)) {
        for (const event of item.messaging) {
          
          // --- FIX START: Handle message_edit / Ghost Events ---
          if (event.message_edit) {
            console.log('✏️ MESSAGE_EDIT detected (Ghost Event). Fetching actual content...');
            const messageId = event.message_edit.mid;
            
            // Fetch the missing data
            const fetchedData = await fetchMessageContent(messageId);
            
            if (fetchedData && fetchedData.text && fetchedData.senderId) {
              console.log('🔄 Converted Ghost Event to Real Message');
              await processMessage(
                fetchedData.senderId, 
                fetchedData.text, 
                messageId, 
                entryId,
                fetchedData.senderName // Pass name if available
              );
            } else {
              console.log('⚠️ Could not recover data for message_edit event');
            }
            continue;
          }
          // --- FIX END ---

          // Handle regular messages
          if (event.message && event.sender) {
            const senderId = event.sender.id;
            const messageText = event.message.text;
            const messageId = event.message.mid;
            
            if (senderId && messageText) {
              await processMessage(senderId, messageText, messageId, entryId);
            }
          }
        }
      }
    }

    res.status(200).send('EVENT_RECEIVED');
    
  } catch (error) {
    console.error('❌ INSTAGRAM WEBHOOK ERROR:', error.message);
    logWebhookData({ type: 'error', error: error.message });
    res.status(200).send('EVENT_RECEIVED');
  }
};

// Helper function to process messages
async function processMessage(senderId, messageText, messageId, entryId, senderUsername = null) {
  try {
    console.log(`📝 Processing: "${messageText}" from ${senderId}`);

    // Check if lead exists
    let lead = await Lead.findOne({
      platform: 'instagram',
      platformId: senderId
    });

    if (lead) {
      lead.message = messageText;
      lead.lastInteractionAt = new Date();
      lead.interactionCount = (lead.interactionCount || 0) + 1;
      
      // Update name if we fetched a username and the current name is generic
      if (senderUsername && lead.name.startsWith('Instagram User')) {
        lead.name = senderUsername;
      }

      lead.notes.push({
        text: `New message: ${messageText}`,
        createdAt: new Date()
      });
      console.log('📝 Updated existing lead');
    } else {
      console.log('✨ Creating new lead');
      lead = new Lead({
        name: senderUsername || `Instagram User ${senderId}`,
        platform: 'instagram',
        platformId: senderId,
        message: messageText,
        status: 'new',
        qualification: 'cold',
        interactionType: 'message',
        interactionCount: 1,
        lastInteractionAt: new Date()
      });
    }

    await lead.save();

    // Send auto-reply if not sent before
    if (!lead.autoReplySent) {
      const autoReplyMessage = process.env.IG_AUTO_REPLY_MESSAGE || 
        "Thanks for reaching out! We've received your message and will get back to you soon. 😊";
      
      const result = await sendInstagramMessage(senderId, autoReplyMessage);
      if (result.success) {
        lead.autoReplySent = true;
        await lead.save();
      }
    }
  } catch (error) {
    console.error('❌ Error processing message:', error);
  }
}

// WhatsApp Webhook (Unchanged)
exports.whatsappWebhook = async (req, res) => {
  try {
    const { From, Body, ProfileName } = req.body;
    const lead = new Lead({
      name: ProfileName || 'Unknown',
      phone: From,
      platform: 'whatsapp',
      platformId: From,
      message: Body,
      status: 'new',
      qualification: 'cold'
    });
    await lead.save();
    res.status(200).send('OK');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Facebook Messenger Webhook (Unchanged)
exports.facebookWebhook = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      if (mode === 'subscribe' && token === process.env.FB_VERIFY_TOKEN) {
        return res.status(200).send(challenge);
      }
      return res.sendStatus(403);
    }
    // Simple FB processing logic...
    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Debug endpoint
exports.instagramWebhookDebug = async (req, res) => {
  logWebhookData({ type: 'debug_endpoint', body: req.body });
  res.status(200).send('LOGGED');
};

module.exports = exports;