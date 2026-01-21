// ===================================
// models/MessageTemplate.js
// ===================================
const mongoose = require('mongoose');

const messageTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  category: {
    type: String,
    enum: ['greeting', 'follow_up', 'promotional', 'reminder', 'support'],
    required: true
  },
  subject: String,
  message: {
    type: String,
    required: true
  },
  platform: {
    type: String,
    enum: ['whatsapp', 'instagram', 'email', 'all'],
    default: 'all'
  },
  variables: [{
    name: String,
    placeholder: String,
    defaultValue: String
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('MessageTemplate', messageTemplateSchema);