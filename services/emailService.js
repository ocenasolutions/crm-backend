const axios = require('axios');

class EmailService {
  constructor() {
    this.apiKey = process.env.BREVO_API_KEY;
    this.senderEmail = process.env.BREVO_SENDER_EMAIL;
    this.baseUrl = 'https://api.brevo.com/v3';
  }

  async sendEmail({ to, subject, message, leadName }) {
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .message { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Hello ${leadName}!</h1>
            </div>
            <div class="content">
              <div class="message">
                ${message.replace(/\n/g, '<br>')}
              </div>
              <div class="footer">
                <p>This email was sent to you as part of our marketing campaign.</p>
                <p>If you wish to unsubscribe, please reply to this email.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const response = await axios.post(
        `${this.baseUrl}/smtp/email`,
        {
          sender: { 
            email: this.senderEmail,
            name: 'CRM System'
          },
          to: [{ email: to, name: leadName }],
          subject: subject,
          htmlContent: htmlContent
        },
        {
          headers: {
            'accept': 'application/json',
            'api-key': this.apiKey,
            'content-type': 'application/json'
          }
        }
      );

      console.log(`✅ Email sent to ${to}: ${response.data.messageId}`);
      return { success: true, messageId: response.data.messageId };
    } catch (error) {
      console.error('Brevo email error:', error.response?.data || error.message);
      throw new Error('Failed to send email via Brevo');
    }
  }

  async sendBulkEmails(emails) {
    const results = [];
    
    for (const email of emails) {
      try {
        const result = await this.sendEmail(email);
        results.push({ ...email, ...result });
      } catch (error) {
        results.push({ ...email, success: false, error: error.message });
      }
    }

    return results;
  }
}

module.exports = new EmailService();