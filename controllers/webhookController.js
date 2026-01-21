// Replace your webhookController.js with this enhanced version for debugging

const Lead = require('../models/Lead');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Enhanced logging function
const logWebhookData = (data) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...data
  };
  
  console.log('=== WEBHOOK LOG ===');
  console.log(JSON.stringify(logEntry, null, 2));
  console.log('==================');
  
  // Also write to file for persistence
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
    // Keep only last 100 logs
    if (logs.length > 100) logs.shift();
    
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error('Failed to write log file:', err);
  }
};

// Auto-reply to new messages
const sendInstagramMessage = async (recipientId, message) => {
  try {
    const igUserId = process.env.IG_USER_ID;
    const accessToken = process.env.IG_ACCESS_TOKEN;
    
    logWebhookData({
      action: 'sendInstagramMessage',
      recipientId,
      message,
      igUserId,
      hasAccessToken: !!accessToken
    });

    if (!igUserId) {
      console.error('❌ IG_USER_ID not configured');
      return null;
    }

    if (!accessToken) {
      console.error('❌ IG_ACCESS_TOKEN not configured');
      return null;
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
    
    console.log('✅ Auto-reply sent successfully');
    logWebhookData({
      action: 'sendInstagramMessage_success',
      recipientId,
      response: response.data
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Error sending auto-reply:');
    console.error('Status:', error.response?.status);
    console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    
    logWebhookData({
      action: 'sendInstagramMessage_error',
      recipientId,
      error: {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      }
    });
    
    return null;
  }
};

// Instagram Webhook - ENHANCED DEBUG VERSION
exports.instagramWebhook = async (req, res) => {
  try {
    // Log EVERYTHING that comes in
    logWebhookData({
      type: 'instagram_webhook',
      method: req.method,
      query: req.query,
      headers: req.headers,
      body: req.body,
      url: req.url,
      originalUrl: req.originalUrl
    });

    // ==========================================
    // WEBHOOK VERIFICATION (GET REQUEST)
    // ==========================================
    if (req.method === 'GET') {
      console.log('🔍 Instagram webhook VERIFICATION request received');
      console.log('Query params:', req.query);
      
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      
      logWebhookData({
        type: 'verification',
        mode,
        receivedToken: token,
        expectedToken: process.env.IG_VERIFY_TOKEN,
        challenge
      });
      
      if (mode && token) {
        if (mode === 'subscribe' && token === process.env.IG_VERIFY_TOKEN) {
          console.log('✅ WEBHOOK_VERIFIED');
          logWebhookData({ type: 'verification_success' });
          return res.status(200).send(challenge);
        } else {
          console.log('❌ Verification token mismatch');
          console.log('Expected:', process.env.IG_VERIFY_TOKEN);
          console.log('Received:', token);
          logWebhookData({ type: 'verification_failed', reason: 'token_mismatch' });
          return res.sendStatus(403);
        }
      }
      
      console.log('❌ Missing hub.mode or hub.verify_token');
      logWebhookData({ type: 'verification_failed', reason: 'missing_params' });
      return res.sendStatus(400);
    }
    
    // ==========================================
    // WEBHOOK EVENTS (POST REQUEST)
    // ==========================================
    console.log('=== INSTAGRAM WEBHOOK EVENT RECEIVED ===');
    console.log('Method:', req.method);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('========================================');
    
    const { entry, object } = req.body;
    
    logWebhookData({
      type: 'webhook_event',
      object,
      entryCount: entry?.length || 0,
      rawBody: req.body
    });

    if (!entry) {
      console.log('⚠️ No entry data in webhook');
      logWebhookData({ type: 'no_entry_data' });
      return res.status(200).send('EVENT_RECEIVED');
    }

    for (const item of entry) {
      console.log('Processing entry item:', JSON.stringify(item, null, 2));
      
      // Handle MESSAGES
      if (item.messaging) {
        console.log('📨 Found messaging event');
        logWebhookData({
          type: 'messaging_event',
          messagingCount: item.messaging.length,
          data: item.messaging
        });
        
        for (const event of item.messaging) {
          const senderId = event.sender?.id;
          const messageText = event.message?.text;
          const senderName = event.sender?.username;

          console.log('📩 Message event:', { senderId, messageText, senderName });
          logWebhookData({
            type: 'message_details',
            senderId,
            messageText,
            senderName,
            fullEvent: event
          });

          if (senderId && messageText) {
            // Check if lead exists
            let lead = await Lead.findOne({
              platform: 'instagram',
              platformId: senderId
            });

            if (lead) {
              lead.message = messageText;
              lead.lastInteractionAt = new Date();
              lead.interactionCount = (lead.interactionCount || 0) + 1;
              lead.notes.push({
                text: `New message: ${messageText}`,
                createdAt: new Date()
              });
              console.log('🔄 Updating existing lead:', lead._id);
              logWebhookData({ type: 'lead_updated', leadId: lead._id });
            } else {
              lead = new Lead({
                name: senderName || 'Instagram User',
                platform: 'instagram',
                platformId: senderId,
                message: messageText,
                status: 'new',
                qualification: 'cold',
                interactionType: 'message',
                interactionCount: 1,
                lastInteractionAt: new Date()
              });
              console.log('✨ Creating new lead');
              logWebhookData({ type: 'lead_created', platformId: senderId });
            }

            await lead.save();
            console.log('✅ Instagram message lead saved:', lead._id);

            // Send auto-reply
            const autoReplyMessage = process.env.IG_AUTO_REPLY_MESSAGE || 
              "Thanks for reaching out! We've received your message and will get back to you soon. 😊";
            
            try {
              await sendInstagramMessage(senderId, autoReplyMessage);
            } catch (error) {
              console.error('Auto-reply failed, but lead was saved');
              logWebhookData({
                type: 'auto_reply_failed',
                error: error.message
              });
            }
          } else {
            logWebhookData({
              type: 'incomplete_message_data',
              hasSenderId: !!senderId,
              hasMessageText: !!messageText
            });
          }
        }
      }

      // Handle FOLLOWS
      if (item.changes) {
        console.log('👥 Found changes event');
        logWebhookData({
          type: 'changes_event',
          changesCount: item.changes.length,
          data: item.changes
        });
        
        for (const change of item.changes) {
          logWebhookData({
            type: 'change_detail',
            field: change.field,
            value: change.value
          });
          
          // New follower
          if (change.field === 'follows' && change.value?.verb === 'follow') {
            const followerId = change.value.user_id;
            const followerUsername = change.value.username;

            console.log('👤 New follower:', { followerId, followerUsername });

            let lead = await Lead.findOne({
              platform: 'instagram',
              platformId: followerId
            });

            if (lead) {
              lead.isFollower = true;
              lead.followedAt = new Date();
              lead.notes.push({
                text: 'Started following',
                createdAt: new Date()
              });
            } else {
              lead = new Lead({
                name: followerUsername || 'Instagram User',
                platform: 'instagram',
                platformId: followerId,
                message: 'Started following your account',
                status: 'new',
                qualification: 'warm',
                interactionType: 'follow',
                isFollower: true,
                followedAt: new Date(),
                interactionCount: 1,
                lastInteractionAt: new Date()
              });
            }

            await lead.save();
            console.log('✅ New follower saved:', lead._id);

            const welcomeMessage = process.env.IG_FOLLOW_MESSAGE || 
              "Hey! Thanks for following us! 🎉 Feel free to send us a message if you have any questions!";
            
            try {
              await sendInstagramMessage(followerId, welcomeMessage);
            } catch (error) {
              console.error('Welcome message failed, but follower was saved');
            }
          }

          // COMMENTS
          if (change.field === 'comments' && change.value) {
            const commenterId = change.value.from?.id;
            const commenterUsername = change.value.from?.username;
            const commentText = change.value.text;
            const mediaId = change.value.media?.id;

            console.log('💬 Comment event:', { commenterId, commenterUsername, commentText });

            if (commenterId && commentText) {
              let lead = await Lead.findOne({
                platform: 'instagram',
                platformId: commenterId
              });

              if (lead) {
                lead.hasCommented = true;
                lead.interactionCount = (lead.interactionCount || 0) + 1;
                lead.lastInteractionAt = new Date();
                lead.notes.push({
                  text: `Commented on post: ${commentText}`,
                  createdAt: new Date()
                });
              } else {
                lead = new Lead({
                  name: commenterUsername || 'Instagram User',
                  platform: 'instagram',
                  platformId: commenterId,
                  message: `Comment: ${commentText}`,
                  status: 'new',
                  qualification: 'warm',
                  interactionType: 'comment',
                  hasCommented: true,
                  interactionCount: 1,
                  lastInteractionAt: new Date(),
                  metadata: {
                    mediaId: mediaId,
                    commentText: commentText
                  }
                });
              }

              await lead.save();
              console.log('✅ Comment lead saved:', lead._id);

              const commentReplyMessage = process.env.IG_COMMENT_REPLY_MESSAGE || 
                "Thanks for your comment! We appreciate your engagement! 💬";
              
              try {
                await sendInstagramMessage(commenterId, commentReplyMessage);
              } catch (error) {
                console.error('Comment reply failed, but comment was saved');
              }
            }
          }

          // MENTIONS
          if (change.field === 'mentions' && change.value) {
            const mentionerId = change.value.from?.id;
            const mentionerUsername = change.value.from?.username;
            const mediaId = change.value.media_id;

            console.log('🏷️ Mention event:', { mentionerId, mentionerUsername });

            if (mentionerId) {
              let lead = await Lead.findOne({
                platform: 'instagram',
                platformId: mentionerId
              });

              if (lead) {
                lead.hasMentioned = true;
                lead.interactionCount = (lead.interactionCount || 0) + 1;
                lead.lastInteractionAt = new Date();
                lead.notes.push({
                  text: 'Mentioned you in a story/post',
                  createdAt: new Date()
                });
              } else {
                lead = new Lead({
                  name: mentionerUsername || 'Instagram User',
                  platform: 'instagram',
                  platformId: mentionerId,
                  message: 'Mentioned you in a story/post',
                  status: 'new',
                  qualification: 'hot',
                  interactionType: 'mention',
                  hasMentioned: true,
                  interactionCount: 1,
                  lastInteractionAt: new Date(),
                  metadata: {
                    mediaId: mediaId
                  }
                });
              }

              await lead.save();
              console.log('✅ Mention lead saved:', lead._id);

              const mentionReplyMessage = process.env.IG_MENTION_REPLY_MESSAGE || 
                "Wow! Thanks so much for mentioning us! 🙌 We really appreciate it!";
              
              try {
                await sendInstagramMessage(mentionerId, mentionReplyMessage);
              } catch (error) {
                console.error('Mention reply failed, but mention was saved');
              }
            }
          }
        }
      }
    }

    logWebhookData({ type: 'processing_complete', success: true });
    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error('❌ Instagram webhook error:', error);
    console.error('Error stack:', error.stack);
    
    logWebhookData({
      type: 'error',
      error: error.message,
      stack: error.stack
    });
    
    // IMPORTANT: Still return 200 to prevent Meta from disabling the webhook
    res.status(200).send('EVENT_RECEIVED');
  }
};

// WhatsApp Webhook
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
    
    console.log('📱 New WhatsApp lead created:', lead._id);
    res.status(200).send('OK');
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Facebook Messenger Webhook
exports.facebookWebhook = async (req, res) => {
  try {
    if (req.method === 'GET') {
      console.log('🔍 Facebook webhook VERIFICATION request');
      
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      
      if (mode === 'subscribe' && token === process.env.FB_VERIFY_TOKEN) {
        console.log('✅ FACEBOOK WEBHOOK_VERIFIED');
        return res.status(200).send(challenge);
      } else {
        console.log('❌ Facebook verification failed');
        return res.sendStatus(403);
      }
    }

    const { entry } = req.body;
    
    if (entry && entry[0].messaging) {
      const messaging = entry[0].messaging[0];
      const senderId = messaging.sender.id;
      const message = messaging.message?.text;

      if (message) {
        const lead = new Lead({
          platform: 'facebook',
          platformId: senderId,
          message: message,
          status: 'new',
          qualification: 'cold'
        });

        await lead.save();
        console.log('👤 New Facebook lead created:', lead._id);
      }
    }

    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error('Facebook webhook error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Debug endpoint
exports.instagramWebhookDebug = async (req, res) => {
  const logData = {
    type: 'debug_endpoint',
    method: req.method,
    query: req.query,
    body: req.body,
    headers: req.headers
  };
  
  console.log('=== RAW INSTAGRAM DATA ===');
  console.log(JSON.stringify(logData, null, 2));
  console.log('========================');
  
  logWebhookData(logData);
  
  res.status(200).send('LOGGED');
};