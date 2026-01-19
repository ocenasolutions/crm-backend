const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  channel: {
    type: String,
    required: true,
    enum: ['email', 'whatsapp', 'instagram', 'facebook', 'website'],
    lowercase: true
  },
  subject: {
    type: String,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  targetAudience: {
    type: String,
    required: true,
    enum: ['all', 'new', 'contacted', 'qualified', 'converted'],
    default: 'all'
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'active', 'completed', 'failed'],
    default: 'draft'
  },
  scheduledFor: {
    type: Date
  },
  sentCount: {
    type: Number,
    default: 0
  },
  deliveredCount: {
    type: Number,
    default: 0
  },
  failedCount: {
    type: Number,
    default: 0
  },
  openedCount: {
    type: Number,
    default: 0
  },
  clickedCount: {
    type: Number,
    default: 0
  },
  sentAt: {
    type: Date
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
campaignSchema.index({ status: 1, createdAt: -1 });
campaignSchema.index({ channel: 1 });

module.exports = mongoose.model('Campaign', campaignSchema);