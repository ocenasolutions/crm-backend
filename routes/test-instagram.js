// routes/test-instagram.js - UPDATED with webhook testing
const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');

// Debug route to check environment variables
router.get('/check-config', (req, res) => {
  const config = {
    IG_USER_ID: process.env.IG_USER_ID ? 'SET' : 'MISSING',
    IG_ACCESS_TOKEN: process.env.IG_ACCESS_TOKEN ? 'SET (length: ' + process.env.IG_ACCESS_TOKEN.length + ')' : 'MISSING',
    IG_VERIFY_TOKEN: process.env.IG_VERIFY_TOKEN ? 'SET' : 'MISSING',
    IG_AUTO_REPLY_MESSAGE: process.env.IG_AUTO_REPLY_MESSAGE ? 'SET' : 'USING DEFAULT',
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT
  };
  
  console.log('Configuration check:', config);
  res.json(config);
});

// Test route to verify server is responding
router.get('/ping', (req, res) => {
  console.log('Ping received at:', new Date().toISOString());
  res.json({ 
    message: 'pong', 
    timestamp: new Date().toISOString(),
    server: 'running'
  });
});

// Test database connection
router.get('/test-db', async (req, res) => {
  try {
    const count = await Lead.countDocuments({ platform: 'instagram' });
    
    res.json({
      success: true,
      message: 'Database connected',
      instagramLeadsCount: count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// Comprehensive diagnostics endpoint
router.get('/diagnostics', async (req, res) => {
  const axios = require('axios');
  const results = {
    timestamp: new Date().toISOString(),
    server: {},
    instagram: {},
    webhooks: {},
    database: {}
  };

  // Check server config
  results.server = {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    hasIgUserId: !!process.env.IG_USER_ID,
    hasIgAccessToken: !!process.env.IG_ACCESS_TOKEN,
    hasIgVerifyToken: !!process.env.IG_VERIFY_TOKEN,
    accessTokenLength: process.env.IG_ACCESS_TOKEN?.length || 0
  };

  // Check Instagram account via Graph API
  if (process.env.IG_USER_ID && process.env.IG_ACCESS_TOKEN) {
    try {
      const igResponse = await axios.get(
        `https://graph.facebook.com/v21.0/${process.env.IG_USER_ID}`,
        {
          params: {
            fields: 'id,username,name,profile_picture_url',
            access_token: process.env.IG_ACCESS_TOKEN
          }
        }
      );
      results.instagram.accountInfo = igResponse.data;
      results.instagram.accountValid = true;
    } catch (error) {
      results.instagram.accountValid = false;
      results.instagram.error = error.response?.data || error.message;
    }

    // Check access token validity
    try {
      const tokenResponse = await axios.get(
        'https://graph.facebook.com/v21.0/debug_token',
        {
          params: {
            input_token: process.env.IG_ACCESS_TOKEN,
            access_token: process.env.IG_ACCESS_TOKEN
          }
        }
      );
      results.instagram.tokenInfo = tokenResponse.data.data;
    } catch (error) {
      results.instagram.tokenError = error.response?.data || error.message;
    }
  } else {
    results.instagram.error = 'IG_USER_ID or IG_ACCESS_TOKEN not configured';
  }

  // Check webhook logs
  try {
    const fs = require('fs');
    const path = require('path');
    const logFile = path.join(__dirname, '../webhook-logs.json');
    
    if (fs.existsSync(logFile)) {
      const logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
      results.webhooks.totalLogs = logs.length;
      results.webhooks.recentLogs = logs.slice(-5);
      
      const webhookPosts = logs.filter(l => l.type === 'webhook_event' && l.method === 'POST');
      results.webhooks.totalWebhookPosts = webhookPosts.length;
      results.webhooks.lastWebhookPost = webhookPosts[webhookPosts.length - 1];
      
      const messages = logs.filter(l => l.type === 'instagram_message');
      results.webhooks.totalMessagesReceived = messages.length;
      results.webhooks.lastMessage = messages[messages.length - 1];
    } else {
      results.webhooks.logs = 'No logs file found';
    }
  } catch (error) {
    results.webhooks.error = error.message;
  }

  // Check database
  try {
    const totalLeads = await Lead.countDocuments({ platform: 'instagram' });
    const recentLeads = await Lead.find({ platform: 'instagram' })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('name platformId message createdAt lastInteractionAt');
    
    results.database.totalInstagramLeads = totalLeads;
    results.database.recentLeads = recentLeads;
  } catch (error) {
    results.database.error = error.message;
  }

  res.json(results);
});

// List all Instagram leads with platformId
router.get('/list-leads', async (req, res) => {
  try {
    const leads = await Lead.find({ 
      platform: 'instagram',
      platformId: { $exists: true, $ne: null }
    })
    .select('name platformId status qualification message createdAt lastInteractionAt')
    .sort({ createdAt: -1 })
    .limit(20);
    
    res.json({
      success: true,
      count: leads.length,
      leads: leads
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Simulate Instagram webhook verification (what Meta sends)
router.get('/simulate-verification', (req, res) => {
  const verifyToken = process.env.IG_VERIFY_TOKEN || 'my_super_secret_123';
  const testChallenge = 'test_challenge_12345';
  
  const simulatedUrl = `/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=${testChallenge}`;
  
  res.json({
    message: 'This is what Meta sends during webhook verification',
    testUrl: simulatedUrl,
    instructions: 'Open this URL to test verification:',
    fullUrl: `${req.protocol}://${req.get('host')}${simulatedUrl}`,
    expectedResponse: testChallenge,
    note: 'If verification works, you should see just the challenge string displayed'
  });
});

// Simulate incoming Instagram message webhook
router.post('/simulate-message', async (req, res) => {
  try {
    const { senderId, messageText } = req.body;
    
    if (!senderId || !messageText) {
      return res.status(400).json({
        error: 'Missing senderId or messageText',
        example: {
          senderId: '1234567890',
          messageText: 'Hello from test!'
        }
      });
    }

    // Simulate the webhook payload that Instagram sends
    const simulatedWebhook = {
      object: 'instagram',
      entry: [{
        id: 'test-entry-id',
        time: Date.now(),
        messaging: [{
          sender: { id: senderId },
          recipient: { id: process.env.IG_USER_ID },
          timestamp: Date.now(),
          message: {
            mid: 'test-message-id-' + Date.now(),
            text: messageText
          }
        }]
      }]
    };

    console.log('🧪 Simulating Instagram webhook with payload:');
    console.log(JSON.stringify(simulatedWebhook, null, 2));

    // Send to the actual webhook handler
    const axios = require('axios');
    const webhookUrl = `${req.protocol}://${req.get('host')}/api/webhooks/instagram`;
    
    const response = await axios.post(webhookUrl, simulatedWebhook, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      message: 'Simulated webhook sent successfully',
      webhookResponse: response.data,
      payload: simulatedWebhook,
      note: 'Check server logs to see webhook processing'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
});

// View recent webhook logs
router.get('/webhook-logs', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const logFile = path.join(__dirname, '../webhook-logs.json');
    
    if (!fs.existsSync(logFile)) {
      return res.json({
        success: true,
        message: 'No webhook logs yet',
        logs: []
      });
    }

    const logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    
    // Get last 20 logs
    const recentLogs = logs.slice(-20).reverse();
    
    res.json({
      success: true,
      count: recentLogs.length,
      totalLogs: logs.length,
      logs: recentLogs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clear webhook logs
router.delete('/webhook-logs', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const logFile = path.join(__dirname, '../webhook-logs.json');
    
    if (fs.existsSync(logFile)) {
      fs.unlinkSync(logFile);
    }
    
    res.json({
      success: true,
      message: 'Webhook logs cleared'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Real-time webhook monitor
router.get('/monitor', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Instagram Webhook Monitor</title>
      <style>
        body { 
          font-family: 'Courier New', monospace;
          background: #1e1e1e;
          color: #d4d4d4;
          padding: 20px;
          margin: 0;
        }
        h1 { color: #E1306C; }
        .log-entry {
          background: #2d2d2d;
          border-left: 4px solid #4EC9B0;
          padding: 15px;
          margin: 10px 0;
          border-radius: 4px;
          white-space: pre-wrap;
          word-break: break-all;
        }
        .timestamp { color: #4EC9B0; }
        .error { border-left-color: #F48771; }
        .success { border-left-color: #89D185; }
        .info { border-left-color: #4FC1FF; }
        #status {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 10px 20px;
          background: #89D185;
          color: #1e1e1e;
          border-radius: 20px;
          font-weight: bold;
        }
        .clear-btn {
          background: #F48771;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <div id="status">● MONITORING</div>
      <h1>📡 Instagram Webhook Monitor</h1>
      <p>Send a message to your Instagram account and watch it appear here in real-time!</p>
      <button class="clear-btn" onclick="clearDisplay()">Clear Display</button>
      <div id="logs"></div>

      <script>
        let lastLogCount = 0;

        async function fetchLogs() {
          try {
            const response = await fetch('/api/test/webhook-logs');
            const data = await response.json();
            
            if (data.success && data.logs.length > lastLogCount) {
              lastLogCount = data.logs.length;
              displayLogs(data.logs);
              
              // Flash status
              const status = document.getElementById('status');
              status.style.background = '#4EC9B0';
              setTimeout(() => status.style.background = '#89D185', 500);
            }
          } catch (error) {
            console.error('Error fetching logs:', error);
          }
        }

        function displayLogs(logs) {
          const logsDiv = document.getElementById('logs');
          logsDiv.innerHTML = '';
          
          // Show last 20 logs in reverse order
          logs.slice(-20).reverse().forEach(log => {
            const entry = document.createElement('div');
            let className = 'log-entry';
            
            if (log.type === 'error') className += ' error';
            else if (log.type === 'instagram_message') className += ' success';
            else if (log.type === 'webhook_event') className += ' info';
            
            entry.className = className;
            entry.innerHTML = \`
              <div class="timestamp">\${log.timestamp}</div>
              <div><strong>Type:</strong> \${log.type}</div>
              <pre>\${JSON.stringify(log, null, 2)}</pre>
            \`;
            logsDiv.appendChild(entry);
          });
        }

        function clearDisplay() {
          document.getElementById('logs').innerHTML = '<p>Display cleared. Logs still saved on server.</p>';
          lastLogCount = 0;
        }

        // Poll every 2 seconds
        setInterval(fetchLogs, 2000);
        
        // Initial fetch
        fetchLogs();
      </script>
    </body>
    </html>
  `);
});

// Test page with all available tests
router.get('/', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Instagram Webhook Test Suite</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          max-width: 1200px; 
          margin: 0 auto; 
          padding: 20px;
          background: #f5f5f5;
        }
        .section {
          background: white;
          padding: 20px;
          margin: 20px 0;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 { color: #E1306C; }
        h2 { color: #405DE6; border-bottom: 2px solid #405DE6; padding-bottom: 10px; }
        .endpoint { 
          background: #f8f9fa; 
          padding: 15px; 
          margin: 10px 0; 
          border-left: 4px solid #405DE6;
          border-radius: 4px;
        }
        .method { 
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-weight: bold;
          margin-right: 10px;
          font-size: 12px;
        }
        .get { background: #61AFFE; color: white; }
        .post { background: #49CC90; color: white; }
        .delete { background: #F93E3E; color: white; }
        code { 
          background: #2d2d2d; 
          color: #f8f8f2; 
          padding: 2px 6px; 
          border-radius: 3px;
          font-family: 'Courier New', monospace;
        }
        .url { color: #0066cc; word-break: break-all; }
        button {
          background: #405DE6;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin: 5px;
        }
        button:hover { background: #5B7BD5; }
        .status { padding: 10px; border-radius: 4px; margin: 10px 0; }
        .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
        .error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
        pre { 
          background: #2d2d2d; 
          color: #f8f8f2; 
          padding: 15px; 
          border-radius: 4px; 
          overflow-x: auto;
        }
      </style>
    </head>
    <body>
      <h1>🔍 Instagram Webhook Test Suite</h1>
      
      <div class="section">
        <h2>📋 Configuration Check</h2>
        <div class="endpoint">
          <span class="method get">GET</span>
          <span class="url">${baseUrl}/api/test/check-config</span>
          <button onclick="testEndpoint('/api/test/check-config', 'GET')">Test</button>
        </div>
      </div>

      <div class="section">
        <h2>🔗 Webhook Verification Test</h2>
        <p>This simulates what Meta sends during webhook setup:</p>
        <div class="endpoint">
          <span class="method get">GET</span>
          <span class="url">${baseUrl}/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=${process.env.IG_VERIFY_TOKEN || 'my_super_secret_123'}&hub.challenge=test123</span>
          <button onclick="window.open('/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=${process.env.IG_VERIFY_TOKEN || 'my_super_secret_123'}&hub.challenge=test123', '_blank')">Test Verification</button>
        </div>
        <p><strong>Expected:</strong> Should display "test123" in new tab</p>
      </div>

      <div class="section">
        <h2>💬 Simulate Incoming Message</h2>
        <p>Simulate an Instagram message being sent to your account:</p>
        <input type="text" id="senderId" placeholder="Instagram User ID" style="width: 300px; padding: 8px; margin: 5px;">
        <input type="text" id="messageText" placeholder="Message text" style="width: 300px; padding: 8px; margin: 5px;">
        <button onclick="simulateMessage()">Simulate Message</button>
      </div>

      <div class="section">
        <h2>📊 View Instagram Leads</h2>
        <div class="endpoint">
          <span class="method get">GET</span>
          <span class="url">${baseUrl}/api/test/list-leads</span>
          <button onclick="testEndpoint('/api/test/list-leads', 'GET')">View Leads</button>
        </div>
      </div>

      <div class="section">
        <h2>📜 Webhook Logs</h2>
        <div class="endpoint">
          <span class="method get">GET</span>
          <span class="url">${baseUrl}/api/test/webhook-logs</span>
          <button onclick="testEndpoint('/api/test/webhook-logs', 'GET')">View Logs</button>
          <button onclick="clearLogs()" style="background: #dc3545;">Clear Logs</button>
        </div>
      </div>

      <div class="section">
        <h2>🎯 Webhook URL for Meta</h2>
        <p>Use this URL in Facebook Developer Console:</p>
        <code style="font-size: 16px; display: block; padding: 15px;">${baseUrl}/api/webhooks/instagram</code>
        <p>Verify Token: <code>${process.env.IG_VERIFY_TOKEN || 'my_super_secret_123'}</code></p>
      </div>

      <div id="result" style="margin-top: 20px;"></div>

      <script>
        async function testEndpoint(path, method = 'GET') {
          const resultDiv = document.getElementById('result');
          resultDiv.innerHTML = '<div class="status">Loading...</div>';
          
          try {
            const response = await fetch(path, { method });
            const data = await response.json();
            resultDiv.innerHTML = '<div class="status success"><h3>Success!</h3><pre>' + JSON.stringify(data, null, 2) + '</pre></div>';
          } catch (error) {
            resultDiv.innerHTML = '<div class="status error"><h3>Error</h3><pre>' + error.message + '</pre></div>';
          }
        }

        async function simulateMessage() {
          const senderId = document.getElementById('senderId').value;
          const messageText = document.getElementById('messageText').value;
          
          if (!senderId || !messageText) {
            alert('Please enter both User ID and Message Text');
            return;
          }

          const resultDiv = document.getElementById('result');
          resultDiv.innerHTML = '<div class="status">Sending simulated webhook...</div>';
          
          try {
            const response = await fetch('/api/test/simulate-message', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ senderId, messageText })
            });
            
            const data = await response.json();
            resultDiv.innerHTML = '<div class="status success"><h3>Webhook Simulated!</h3><p>Check server logs for processing details</p><pre>' + JSON.stringify(data, null, 2) + '</pre></div>';
          } catch (error) {
            resultDiv.innerHTML = '<div class="status error"><h3>Error</h3><pre>' + error.message + '</pre></div>';
          }
        }

        async function clearLogs() {
          if (!confirm('Clear all webhook logs?')) return;
          
          try {
            await fetch('/api/test/webhook-logs', { method: 'DELETE' });
            alert('Logs cleared!');
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }
      </script>
    </body>
    </html>
  `);
});

router.post('/manual-message', async (req, res) => {
  try {
    const { senderId, senderUsername, messageText } = req.body;
    
    if (!senderId || !messageText) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['senderId', 'messageText'],
        optional: ['senderUsername']
      });
    }

    console.log('📝 Manual message entry:');
    console.log('  Sender ID:', senderId);
    console.log('  Username:', senderUsername || 'N/A');
    console.log('  Message:', messageText);

    // Check if lead exists
    let lead = await Lead.findOne({
      platform: 'instagram',
      platformId: senderId
    });

    if (lead) {
      lead.message = messageText;
      lead.lastInteractionAt = new Date();
      lead.interactionCount = (lead.interactionCount || 0) + 1;
      if (senderUsername && !lead.name.includes('@')) {
        lead.name = `@${senderUsername}`;
      }
      lead.notes.push({
        text: `Manual entry: ${messageText}`,
        createdAt: new Date()
      });
      console.log('📝 Updated existing lead:', lead._id);
    } else {
      lead = new Lead({
        name: senderUsername ? `@${senderUsername}` : `Instagram User ${senderId}`,
        platform: 'instagram',
        platformId: senderId,
        message: messageText,
        status: 'new',
        qualification: 'cold',
        interactionType: 'message',
        interactionCount: 1,
        lastInteractionAt: new Date()
      });
      console.log('✨ Created new lead:', lead._id);
    }

    await lead.save();

    res.json({
      success: true,
      message: 'Lead saved successfully',
      lead: {
        id: lead._id,
        name: lead.name,
        platformId: lead.platformId,
        message: lead.message,
        status: lead.status
      }
    });

  } catch (error) {
    console.error('Error in manual message entry:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;