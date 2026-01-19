const axios = require('axios');

class WhatsAppService {
  constructor() {
    this.apiUrl = process.env.WHATSAPP_API_URL;
    this.token = process.env.WHATSAPP_TOKEN;
    this.phoneId = process.env.WHATSAPP_PHONE_ID;
  }

  async sendMessage({ to, message }) {
    try {
      // Remove any non-numeric characters from phone number
      const cleanPhone = to.replace(/\D/g, '');

      const response = await axios.post(
        `${this.apiUrl}/${this.phoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: {
            preview_url: false,
            body: message
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ WhatsApp message sent to ${cleanPhone}: ${response.data.messages[0].id}`);
      return { 
        success: true, 
        messageId: response.data.messages[0].id 
      };
    } catch (error) {
      console.error('WhatsApp send error:', error.response?.data || error.message);
      throw new Error('Failed to send WhatsApp message');
    }
  }

  async sendTemplateMessage({ to, templateName, languageCode = 'en', components = [] }) {
    try {
      const cleanPhone = to.replace(/\D/g, '');

      const response = await axios.post(
        `${this.apiUrl}/${this.phoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: languageCode
            },
            components: components
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ WhatsApp template sent to ${cleanPhone}`);
      return { 
        success: true, 
        messageId: response.data.messages[0].id 
      };
    } catch (error) {
      console.error('WhatsApp template error:', error.response?.data || error.message);
      throw new Error('Failed to send WhatsApp template');
    }
  }

  async sendMediaMessage({ to, mediaType, mediaUrl, caption = '' }) {
    try {
      const cleanPhone = to.replace(/\D/g, '');

      const response = await axios.post(
        `${this.apiUrl}/${this.phoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: mediaType, // image, video, document, audio
          [mediaType]: {
            link: mediaUrl,
            caption: caption
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ WhatsApp media sent to ${cleanPhone}`);
      return { 
        success: true, 
        messageId: response.data.messages[0].id 
      };
    } catch (error) {
      console.error('WhatsApp media error:', error.response?.data || error.message);
      throw new Error('Failed to send WhatsApp media');
    }
  }

  async markAsRead(messageId) {
    try {
      await axios.post(
        `${this.apiUrl}/${this.phoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId
        },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ Message marked as read: ${messageId}`);
      return { success: true };
    } catch (error) {
      console.error('WhatsApp mark read error:', error.response?.data || error.message);
      throw new Error('Failed to mark message as read');
    }
  }
}

module.exports = new WhatsAppService();