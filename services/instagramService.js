const axios = require('axios');

class InstagramService {
  constructor() {
    this.token = process.env.INSTAGRAM_TOKEN;
    this.pageId = process.env.INSTAGRAM_PAGE_ID;
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
            access_token: this.token
          }
        }
      );

      console.log(`✅ Instagram message sent to ${recipientId}`);
      return { 
        success: true, 
        messageId: response.data.message_id 
      };
    } catch (error) {
      console.error('Instagram send error:', error.response?.data || error.message);
      throw new Error('Failed to send Instagram message');
    }
  }

  async sendImage({ recipientId, imageUrl }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/me/messages`,
        {
          recipient: {
            id: recipientId
          },
          message: {
            attachment: {
              type: 'image',
              payload: {
                url: imageUrl,
                is_reusable: true
              }
            }
          }
        },
        {
          params: {
            access_token: this.token
          }
        }
      );

      console.log(`✅ Instagram image sent to ${recipientId}`);
      return { 
        success: true, 
        messageId: response.data.message_id 
      };
    } catch (error) {
      console.error('Instagram image error:', error.response?.data || error.message);
      throw new Error('Failed to send Instagram image');
    }
  }

  async getUserProfile(userId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${userId}`,
        {
          params: {
            fields: 'name,username,profile_pic',
            access_token: this.token
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Instagram profile error:', error.response?.data || error.message);
      throw new Error('Failed to get Instagram user profile');
    }
  }

  async getConversation(conversationId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${conversationId}`,
        {
          params: {
            fields: 'messages{message,from,created_time}',
            access_token: this.token
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Instagram conversation error:', error.response?.data || error.message);
      throw new Error('Failed to get Instagram conversation');
    }
  }

  async markAsSeen(messageId) {
    try {
      await axios.post(
        `${this.baseUrl}/me/messages`,
        {
          recipient: {
            id: messageId
          },
          sender_action: 'mark_seen'
        },
        {
          params: {
            access_token: this.token
          }
        }
      );

      console.log(`✅ Instagram message marked as seen: ${messageId}`);
      return { success: true };
    } catch (error) {
      console.error('Instagram mark seen error:', error.response?.data || error.message);
      throw new Error('Failed to mark Instagram message as seen');
    }
  }
}

module.exports = new InstagramService();