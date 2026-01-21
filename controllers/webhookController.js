const Lead = require('../models/Lead');
const axios = require('axios');

// Auto-reply to new messages
const sendInstagramMessage = async (recipientId, message) => {
  try {
    const igUserId = process.env.IG_USER_ID;
    const accessToken = process.env.IG_ACCESS_TOKEN;
    
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
    return response.data;
  } catch (error) {
    console.error('❌ Error sending auto-reply:');
    console.error('Status:', error.response?.status);
    console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    return null;
  }
};

// Instagram Webhook - FIXED VERSION
exports.instagramWebhook = async (req, res) => {
  try {
    // ==========================================
    // WEBHOOK VERIFICATION (GET REQUEST)
    // ==========================================
    if (req.method === 'GET') {
      console.log('🔍 Instagram webhook VERIFICATION request received');
      console.log('Query params:', req.query);
      
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      
      // Check if a token and mode were sent
      if (mode && token) {
        // Check the mode and token sent are correct
        if (mode === 'subscribe' && token === process.env.IG_VERIFY_TOKEN) {
          console.log('✅ WEBHOOK_VERIFIED');
          
          // Respond with 200 OK and challenge token from the request
          return res.status(200).send(challenge);
        } else {
          console.log('❌ Verification token mismatch');
          console.log('Expected:', process.env.IG_VERIFY_TOKEN);
          console.log('Received:', token);
          // Responds with '403 Forbidden' if verify tokens do not match
          return res.sendStatus(403);
        }
      }
      
      console.log('❌ Missing hub.mode or hub.verify_token');
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
    
    const { entry } = req.body;
    
    if (!entry) {
      console.log('⚠️ No entry data in webhook');
      return res.status(200).send('EVENT_RECEIVED');
    }

    for (const item of entry) {
      // Handle MESSAGES
      if (item.messaging) {
        for (const event of item.messaging) {
          const senderId = event.sender?.id;
          const messageText = event.message?.text;
          const senderName = event.sender?.username;

          console.log('📩 Message event:', { senderId, messageText, senderName });

          if (senderId && messageText) {
            // Check if lead exists
            let lead = await Lead.findOne({
              platform: 'instagram',
              platformId: senderId
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
            }
          }
        }
      }

      // Handle FOLLOWS
      if (item.changes) {
        for (const change of item.changes) {
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

            // Send welcome message to new follower
            const welcomeMessage = process.env.IG_FOLLOW_MESSAGE || 
              "Hey! Thanks for following us! 🎉 Feel free to send us a message if you have any questions!";
            
            try {
              await sendInstagramMessage(followerId, welcomeMessage);
            } catch (error) {
              console.error('Welcome message failed, but follower was saved');
            }
          }

          // COMMENTS on posts
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

              // Optional: Reply to comment via DM
              const commentReplyMessage = process.env.IG_COMMENT_REPLY_MESSAGE || 
                "Thanks for your comment! We appreciate your engagement! 💬";
              
              try {
                await sendInstagramMessage(commenterId, commentReplyMessage);
              } catch (error) {
                console.error('Comment reply failed, but comment was saved');
              }
            }
          }

          // MENTIONS in stories/posts
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

              // Thank them for the mention
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

    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error('❌ Instagram webhook error:', error);
    console.error('Error stack:', error.stack);
    // IMPORTANT: Still return 200 to prevent Meta from disabling the webhook
    res.status(200).send('EVENT_RECEIVED');
  }
};

// WhatsApp Webhook (for services like Twilio, WhatsApp Business API)
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
    // Verify webhook (GET request)
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

    // Handle events (POST request)
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

// Debug endpoint to log raw webhook data
exports.instagramWebhookDebug = async (req, res) => {
  console.log('=== RAW INSTAGRAM DATA ===');
  console.log('Method:', req.method);
  console.log('Query:', JSON.stringify(req.query, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('========================');
  
  res.status(200).send('LOGGED');
};