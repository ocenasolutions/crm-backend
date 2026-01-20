const Imap = require('imap');
const { simpleParser } = require('mailparser');
const Lead = require('../models/Lead');

let imap;

const connectImap = () => {
  imap = new Imap({
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    host: process.env.EMAIL_IMAP_HOST || 'imap.gmail.com',
    port: process.env.EMAIL_IMAP_PORT || 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
  });

  imap.once('ready', () => {
    console.log('📧 IMAP Connected');
    openInbox();
  });

  imap.once('error', (err) => {
    console.error('IMAP Error:', err);
  });

  imap.once('end', () => {
    console.log('📧 IMAP Connection ended');
    // Reconnect after 30 seconds
    setTimeout(connectImap, 30000);
  });

  imap.connect();
};

const openInbox = () => {
  imap.openBox('INBOX', false, (err, box) => {
    if (err) {
      console.error('Error opening inbox:', err);
      return;
    }

    // Listen for new emails
    imap.on('mail', () => {
      fetchNewEmails();
    });

    // Fetch unseen emails on startup
    fetchNewEmails();
  });
};

const fetchNewEmails = () => {
  imap.search(['UNSEEN'], (err, results) => {
    if (err || !results || results.length === 0) {
      return;
    }

    const fetch = imap.fetch(results, { bodies: '' });

    fetch.on('message', (msg) => {
      msg.on('body', (stream) => {
        simpleParser(stream, async (err, parsed) => {
          if (err) {
            console.error('Email parsing error:', err);
            return;
          }

          try {
            // Check if lead already exists
            const existingLead = await Lead.findOne({
              email: parsed.from.value[0].address,
              platform: 'email'
            });

            if (!existingLead) {
              const lead = new Lead({
                name: parsed.from.value[0].name || parsed.from.value[0].address,
                email: parsed.from.value[0].address,
                platform: 'email',
                platformId: parsed.from.value[0].address,
                message: parsed.text || parsed.html || 'No content',
                status: 'new',
                qualification: 'cold',
                metadata: {
                  subject: parsed.subject,
                  receivedAt: parsed.date
                }
              });

              await lead.save();
              console.log('📬 New email lead created:', lead._id);
            }
          } catch (error) {
            console.error('Error creating lead from email:', error);
          }
        });
      });
    });

    fetch.once('end', () => {
      console.log('Finished processing new emails');
    });
  });
};

exports.startEmailMonitoring = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log('⚠️  Email credentials not configured. Email monitoring disabled.');
    return;
  }

  connectImap();
};