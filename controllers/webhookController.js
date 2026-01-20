const Lead = require('../models/Lead');

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
    // Verify webhook (required by Facebook)
    if (req.query['hub.mode'] === 'subscribe' && 
        req.query['hub.verify_token'] === process.env.FB_VERIFY_TOKEN) {
      return res.status(200).send(req.query['hub.challenge']);
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

// Instagram Webhook
exports.instagramWebhook = async (req, res) => {
  try {
    console.log('=== INSTAGRAM WEBHOOK RECEIVED ===');
    console.log('Method:', req.method);
    console.log('Query params:', JSON.stringify(req.query, null, 2));
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('===================================');
    
    // Verify webhook (GET request from Instagram)
    if (req.query['hub.mode'] === 'subscribe' && 
        req.query['hub.verify_token'] === process.env.IG_VERIFY_TOKEN) {
      console.log('✅ Instagram webhook verification successful');
      return res.status(200).send(req.query['hub.challenge']);
    }

    // Handle webhook events (POST request)
    const { entry } = req.body;
    
    if (!entry) {
      console.log('⚠️ No entry data in webhook');
      return res.status(200).send('EVENT_RECEIVED');
    }

    console.log('Processing', entry.length, 'entries');

    for (const item of entry) {
      console.log('Entry item:', JSON.stringify(item, null, 2));
      
      // Instagram can send data in different formats
      // Check for messaging events
      if (item.messaging) {
        console.log('Found messaging events:', item.messaging.length);
        
        for (const event of item.messaging) {
          console.log('Event:', JSON.stringify(event, null, 2));
          
          const senderId = event.sender?.id;
          const messageText = event.message?.text;
          const senderName = event.sender?.username;

          console.log('Extracted - Sender ID:', senderId, 'Message:', messageText, 'Name:', senderName);

          if (senderId && messageText) {
            const lead = new Lead({
              name: senderName || 'Instagram User',
              platform: 'instagram',
              platformId: senderId,
              message: messageText,
              status: 'new',
              qualification: 'cold'
            });

            await lead.save();
            console.log('✅ Instagram lead created successfully!');
            console.log('Lead ID:', lead._id);
            console.log('Lead data:', JSON.stringify(lead.toObject(), null, 2));
          } else {
            console.log('⚠️ Missing required data - Sender ID:', senderId, 'Message:', messageText);
          }
        }
      }
      
      // Check for changes/comments (Instagram might use this format)
      if (item.changes) {
        console.log('Found changes events:', item.changes.length);
        
        for (const change of item.changes) {
          console.log('Change:', JSON.stringify(change, null, 2));
          
          const value = change.value;
          const senderId = value?.from?.id || value?.sender_id;
          const messageText = value?.text || value?.message;
          const senderName = value?.from?.username;

          console.log('Extracted from changes - Sender ID:', senderId, 'Message:', messageText);

          if (senderId && messageText) {
            const lead = new Lead({
              name: senderName || 'Instagram User',
              platform: 'instagram',
              platformId: senderId,
              message: messageText,
              status: 'new',
              qualification: 'cold'
            });

            await lead.save();
            console.log('✅ Instagram lead created from changes!');
            console.log('Lead ID:', lead._id);
          }
        }
      }
    }

    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error('❌ Instagram webhook error:', error);
    console.error('Error stack:', error.stack);
    // Always return 200 to Instagram to avoid retries
    res.status(200).send('EVENT_RECEIVED');
  }
};

exports.instagramWebhookDebug = async (req, res) => {
  console.log('=== RAW INSTAGRAM DATA ===');
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('========================');
  
  // Save to a file for inspection
  const fs = require('fs');
  fs.writeFileSync('instagram-webhook-data.json', JSON.stringify(req.body, null, 2));
  
  res.status(200).send('LOGGED');
};