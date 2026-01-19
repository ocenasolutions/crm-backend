const Lead = require('../models/Lead');

// WhatsApp Webhook Verification
exports.verifyWhatsApp = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
};

// WhatsApp Webhook Handler
exports.handleWhatsAppWebhook = async (req, res) => {
  try {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
      body.entry?.forEach(entry => {
        entry.changes?.forEach(change => {
          if (change.value.messages) {
            change.value.messages.forEach(async (message) => {
              const from = message.from;
              const text = message.text?.body || '';
              const name = change.value.contacts?.[0]?.profile?.name || 'Unknown';

              // Create lead from WhatsApp message
              const lead = new Lead({
                name,
                phone: from,
                source: 'whatsapp',
                message: text,
                metadata: new Map([
                  ['whatsapp_message_id', message.id],
                  ['timestamp', message.timestamp]
                ])
              });

              await lead.save();
              console.log(`✅ WhatsApp lead created: ${name} (${from})`);
            });
          }
        });
      });
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    res.sendStatus(500);
  }
};

// Instagram Webhook Verification
exports.verifyInstagram = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
    console.log('✅ Instagram webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
};

// Instagram Webhook Handler
exports.handleInstagramWebhook = async (req, res) => {
  try {
    const body = req.body;

    if (body.object === 'instagram') {
      body.entry?.forEach(entry => {
        entry.messaging?.forEach(async (event) => {
          if (event.message) {
            const senderId = event.sender.id;
            const text = event.message.text || '';

            // Fetch sender info from Instagram API
            // This is a simplified version - you'd need to implement actual API call
            const lead = new Lead({
              name: `Instagram User ${senderId}`,
              source: 'instagram',
              message: text,
              metadata: new Map([
                ['instagram_id', senderId],
                ['message_id', event.message.mid]
              ])
            });

            await lead.save();
            console.log(`✅ Instagram lead created: ${senderId}`);
          }
        });
      });
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Instagram webhook error:', error);
    res.sendStatus(500);
  }
};

// Facebook Webhook Verification
exports.verifyFacebook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.FACEBOOK_VERIFY_TOKEN) {
    console.log('✅ Facebook webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
};

// Facebook Webhook Handler
exports.handleFacebookWebhook = async (req, res) => {
  try {
    const body = req.body;

    if (body.object === 'page') {
      body.entry?.forEach(entry => {
        entry.messaging?.forEach(async (event) => {
          if (event.message) {
            const senderId = event.sender.id;
            const text = event.message.text || '';

            // Fetch sender info from Facebook API
            const lead = new Lead({
              name: `Facebook User ${senderId}`,
              source: 'facebook',
              message: text,
              metadata: new Map([
                ['facebook_id', senderId],
                ['message_id', event.message.mid]
              ])
            });

            await lead.save();
            console.log(`✅ Facebook lead created: ${senderId}`);
          }
        });
      });
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Facebook webhook error:', error);
    res.sendStatus(500);
  }
};

// Website Form Submission Handler
exports.handleWebsiteSubmission = async (req, res) => {
  try {
    const { name, email, phone, message, metadata } = req.body;

    if (!name || (!email && !phone)) {
      return res.status(400).json({ 
        error: 'Name and either email or phone are required' 
      });
    }

    const lead = new Lead({
      name,
      email,
      phone,
      source: 'website',
      message,
      metadata: metadata ? new Map(Object.entries(metadata)) : undefined
    });

    await lead.save();
    console.log(`✅ Website lead created: ${name}`);

    res.status(201).json({ 
      success: true,
      message: 'Thank you! We will contact you soon.',
      leadId: lead._id
    });
  } catch (error) {
    console.error('Website submission error:', error);
    res.status(500).json({ error: 'Failed to submit form' });
  }
};