const Lead = require('../models/Lead');
const fs = require('fs');
const path = require('path');

// Helper function to log webhook data to file for debugging
const logWebhookData = (data, filename = 'instagram-webhook-log.json') => {
  try {
    const logPath = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logPath)) {
      fs.mkdirSync(logPath, { recursive: true });
    }
    
    const logFile = path.join(logPath, filename);
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      data
    };
    
    // Append to log file
    let logs = [];
    if (fs.existsSync(logFile)) {
      const existingData = fs.readFileSync(logFile, 'utf8');
      try {
        logs = JSON.parse(existingData);
      } catch (e) {
        logs = [];
      }
    }
    
    logs.push(logEntry);
    
    // Keep only last 100 entries
    if (logs.length > 100) {
      logs = logs.slice(-100);
    }
    
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Error logging webhook data:', error);
  }
};

// Instagram Webhook
exports.instagramWebhook = async (req, res) => {
  try {
    console.log('=== INSTAGRAM WEBHOOK RECEIVED ===');
    console.log('Method:', req.method);
    console.log('Timestamp:', new Date().toISOString());
    console.log('Query params:', JSON.stringify(req.query, null, 2));
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('===================================');
    
    // Log all webhook data to file
    logWebhookData({
      method: req.method,
      query: req.query,
      headers: req.headers,
      body: req.body
    });
    
    // Verify webhook (GET request from Instagram)
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      
      console.log('🔍 Verification attempt:');
      console.log('  Mode:', mode);
      console.log('  Token received:', token);
      console.log('  Token expected:', process.env.IG_VERIFY_TOKEN);
      console.log('  Challenge:', challenge);
      
      if (mode === 'subscribe' && token === process.env.IG_VERIFY_TOKEN) {
        console.log('✅ Instagram webhook verification successful');
        return res.status(200).send(challenge);
      } else {
        console.log('❌ Verification failed - token mismatch');
        console.log('  Expected:', process.env.IG_VERIFY_TOKEN);
        console.log('  Received:', token);
        return res.status(403).send('Forbidden');
      }
    }

    // Handle webhook events (POST request)
    if (req.method === 'POST') {
      console.log('📬 Processing POST webhook event...');
      
      const { entry, object } = req.body;
      
      console.log('Webhook object type:', object);
      
      if (!entry || !Array.isArray(entry)) {
        console.log('⚠️ No entry data or invalid format in webhook');
        return res.status(200).send('EVENT_RECEIVED');
      }

      console.log('📦 Processing', entry.length, 'entries');

      let leadsCreated = 0;

      for (const item of entry) {
        console.log('📋 Entry item:', JSON.stringify(item, null, 2));
        
        // Format 1: Instagram Messaging (Direct Messages)
        if (item.messaging && Array.isArray(item.messaging)) {
          console.log('💬 Found messaging events:', item.messaging.length);
          
          for (const event of item.messaging) {
            console.log('Event details:', JSON.stringify(event, null, 2));
            
            const senderId = event.sender?.id;
            const messageText = event.message?.text;
            const senderUsername = event.sender?.username;
            const timestamp = event.timestamp;

            console.log('Extracted data:');
            console.log('  Sender ID:', senderId);
            console.log('  Username:', senderUsername);
            console.log('  Message:', messageText);
            console.log('  Timestamp:', timestamp);

            if (senderId && messageText) {
              try {
                // Check if lead already exists
                const existingLead = await Lead.findOne({
                  platformId: senderId,
                  platform: 'instagram'
                });

                if (existingLead) {
                  console.log('ℹ️ Lead already exists:', existingLead._id);
                  // Optionally update the lead with new message
                  existingLead.message = messageText;
                  existingLead.metadata = {
                    ...existingLead.metadata,
                    lastMessageAt: new Date(timestamp)
                  };
                  await existingLead.save();
                  console.log('✅ Updated existing lead');
                } else {
                  const lead = new Lead({
                    name: senderUsername || `IG User ${senderId}`,
                    platform: 'instagram',
                    platformId: senderId,
                    message: messageText,
                    status: 'new',
                    qualification: 'cold',
                    metadata: {
                      receivedAt: new Date(timestamp),
                      username: senderUsername
                    }
                  });

                  await lead.save();
                  leadsCreated++;
                  console.log('✅ Instagram lead created successfully!');
                  console.log('Lead ID:', lead._id);
                  console.log('Lead data:', JSON.stringify(lead.toObject(), null, 2));
                }
              } catch (error) {
                console.error('❌ Error saving lead:', error);
                console.error('Error stack:', error.stack);
              }
            } else {
              console.log('⚠️ Missing required data - Sender ID:', senderId, 'Message:', messageText);
            }
          }
        }
        
        // Format 2: Instagram Changes (Comments, Mentions, Story Replies)
        if (item.changes && Array.isArray(item.changes)) {
          console.log('🔄 Found changes events:', item.changes.length);
          
          for (const change of item.changes) {
            console.log('Change details:', JSON.stringify(change, null, 2));
            
            const field = change.field;
            const value = change.value;
            
            console.log('Change field:', field);
            
            // Handle comments
            if (field === 'comments' && value) {
              const commentId = value.id;
              const commentText = value.text;
              const from = value.from;
              const mediaId = value.media?.id;
              
              console.log('Comment data:');
              console.log('  From ID:', from?.id);
              console.log('  From Username:', from?.username);
              console.log('  Text:', commentText);
              
              if (from?.id && commentText) {
                try {
                  const existingLead = await Lead.findOne({
                    platformId: from.id,
                    platform: 'instagram'
                  });

                  if (existingLead) {
                    existingLead.message = commentText;
                    existingLead.metadata = {
                      ...existingLead.metadata,
                      lastCommentAt: new Date(),
                      commentId: commentId,
                      mediaId: mediaId
                    };
                    await existingLead.save();
                    console.log('✅ Updated existing lead with comment');
                  } else {
                    const lead = new Lead({
                      name: from.username || `IG User ${from.id}`,
                      platform: 'instagram',
                      platformId: from.id,
                      message: `[Comment] ${commentText}`,
                      status: 'new',
                      qualification: 'cold',
                      metadata: {
                        username: from.username,
                        commentId: commentId,
                        mediaId: mediaId,
                        type: 'comment'
                      }
                    });

                    await lead.save();
                    leadsCreated++;
                    console.log('✅ Instagram lead created from comment!');
                    console.log('Lead ID:', lead._id);
                  }
                } catch (error) {
                  console.error('❌ Error saving comment lead:', error);
                }
              }
            }
            
            // Handle mentions
            if (field === 'mentions' && value) {
              const mentionText = value.text || value.caption;
              const from = value.from;
              const mediaId = value.media_id;
              
              console.log('Mention data:');
              console.log('  From ID:', from?.id);
              console.log('  From Username:', from?.username);
              console.log('  Text:', mentionText);
              
              if (from?.id && mentionText) {
                try {
                  const lead = new Lead({
                    name: from.username || `IG User ${from.id}`,
                    platform: 'instagram',
                    platformId: from.id,
                    message: `[Mention] ${mentionText}`,
                    status: 'new',
                    qualification: 'warm', // Mentions might be more engaged
                    metadata: {
                      username: from.username,
                      mediaId: mediaId,
                      type: 'mention'
                    }
                  });

                  await lead.save();
                  leadsCreated++;
                  console.log('✅ Instagram lead created from mention!');
                  console.log('Lead ID:', lead._id);
                } catch (error) {
                  console.error('❌ Error saving mention lead:', error);
                }
              }
            }
          }
        }
      }

      console.log(`✨ Webhook processing complete. ${leadsCreated} new leads created.`);
      return res.status(200).send('EVENT_RECEIVED');
    }

    // If neither GET nor POST
    console.log('⚠️ Unexpected HTTP method:', req.method);
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('❌ Instagram webhook error:', error);
    console.error('Error stack:', error.stack);
    // Always return 200 to Instagram to avoid retries
    res.status(200).send('EVENT_RECEIVED');
  }
};

// Debug endpoint to view logged webhook data
exports.instagramWebhookDebug = async (req, res) => {
  try {
    const logPath = path.join(__dirname, '..', 'logs', 'instagram-webhook-log.json');
    
    if (fs.existsSync(logPath)) {
      const logData = fs.readFileSync(logPath, 'utf8');
      const logs = JSON.parse(logData);
      
      res.json({
        total: logs.length,
        logs: logs.slice(-10) // Return last 10 entries
      });
    } else {
      res.json({
        message: 'No webhook logs found yet',
        total: 0,
        logs: []
      });
    }
  } catch (error) {
    console.error('Error reading webhook logs:', error);
    res.status(500).json({ error: error.message });
  }
};

// Clear webhook logs
exports.clearWebhookLogs = async (req, res) => {
  try {
    const logPath = path.join(__dirname, '..', 'logs', 'instagram-webhook-log.json');
    
    if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath);
    }
    
    res.json({ message: 'Webhook logs cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};