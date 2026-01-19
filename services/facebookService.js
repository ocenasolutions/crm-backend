const axios = require('axios');

class FacebookService {
  constructor() {
    this.pageToken = process.env.FACEBOOK_PAGE_TOKEN;
    this.pageId = process.env.FACEBOOK_PAGE_ID;
    this.baseUrl = 'https://graph.facebook.com/v18.0';
  }

  async sendMessage({ recipientId, message }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/me/messages`,
        {
          recipient: {
            id: recipientId
          },
          message: {
            text: message
          }
        },
        {
          params: {
            access_token: this.pageToken
          }
        }
      );

      console.log(`✅ Facebook message sent to ${recipientId}`);
      return { 
        success: true, 
        messageId: response.data.message_id 
      };
    } catch (error) {
      console.error('Facebook send error:', error.response?.data || error.message);
      throw new Error('Failed to send Facebook message');
    }
  }

  async sendAttachment({ recipientId, type, url }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/me/messages`,
        {
          recipient: {
            id: recipientId
          },
          message: {
            attachment: {
              type: type, // image, video, audio, file
              payload: {
                url: url,
                is_reusable: true
              }
            }
          }
        },
        {
          params: {
            access_token: this.pageToken
          }
        }
      );

      console.log(`✅ Facebook attachment sent to ${recipientId}`);
      return { 
        success: true, 
        messageId: response.data.message_id 
      };
    } catch (error) {
      console.error('Facebook attachment error:', error.response?.data || error.message);
      throw new Error('Failed to send Facebook attachment');
    }
  }

  async sendQuickReplies({ recipientId, text, quickReplies }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/me/messages`,
        {
          recipient: {
            id: recipientId
          },
          message: {
            text: text,
            quick_replies: quickReplies.map(reply => ({
              content_type: 'text',
              title: reply.title,
              payload: reply.payload
            }))
          }
        },
        {
          params: {
            access_token: this.pageToken
          }
        }
      );

      console.log(`✅ Facebook quick replies sent to ${recipientId}`);
      return { 
        success: true, 
        messageId: response.data.message_id 
      };
    } catch (error) {
      console.error('Facebook quick replies error:', error.response?.data || error.message);
      throw new Error('Failed to send Facebook quick replies');
    }
  }

  async sendButton({ recipientId, text, buttons }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/me/messages`,
        {
          recipient: {
            id: recipientId
          },
          message: {
            attachment: {
              type: 'template',
              payload: {
                template_type: 'button',
                text: text,
                buttons: buttons
              }
            }
          }
        },
        {
          params: {
            access_token: this.pageToken
          }
        }
      );

      console.log(`✅ Facebook button message sent to ${recipientId}`);
      return { 
        success: true, 
        messageId: response.data.message_id 
      };
    } catch (error) {
      console.error('Facebook button error:', error.response?.data || error.message);
      throw new Error('Failed to send Facebook button message');
    }
  }

  async getUserProfile(userId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${userId}`,
        {
          params: {
            fields: 'first_name,last_name,profile_pic',
            access_token: this.pageToken
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Facebook profile error:', error.response?.data || error.message);
      throw new Error('Failed to get Facebook user profile');
    }
  }

  async markAsSeen(senderId) {
    try {
      await axios.post(
        `${this.baseUrl}/me/messages`,
        {
          recipient: {
            id: senderId
          },
          sender_action: 'mark_seen'
        },
        {
          params: {
            access_token: this.pageToken
          }
        }
      );

      console.log(`✅ Facebook message marked as seen for ${senderId}`);
      return { success: true };
    } catch (error) {
      console.error('Facebook mark seen error:', error.response?.data || error.message);
      throw new Error('Failed to mark Facebook message as seen');
    }
  }

  async typingOn(recipientId) {
    try {
      await axios.post(
        `${this.baseUrl}/me/messages`,
        {
          recipient: {
            id: recipientId
          },
          sender_action: 'typing_on'
        },
        {
          params: {
            access_token: this.pageToken
          }
        }
      );

      return { success: true };
    } catch (error) {
      console.error('Facebook typing error:', error.response?.data || error.message);
      throw new Error('Failed to send typing indicator');
    }
  }
}

module.exports = new FacebookService();