const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  platform: {
    type: String,
    required: true,
    enum: ['whatsapp', 'facebook', 'instagram', 'email'],
    lowercase: true
  },
  platformId: {
    type: String,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'follow-up', 'converted', 'closed'],
    default: 'new',
    lowercase: true
  },
  qualification: {
    type: String,
    enum: ['hot', 'warm', 'cold'],
    default: 'cold',
    lowercase: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Instagram-specific fields
  interactionType: {
    type: String,
    enum: ['message', 'follow', 'comment', 'mention', 'story_reply'],
    lowercase: true
  },
  isFollower: {
    type: Boolean,
    default: false
  },
  hasCommented: {
    type: Boolean,
    default: false
  },
  hasMentioned: {
    type: Boolean,
    default: false
  },
  followedAt: {
    type: Date
  },
  lastInteractionAt: {
    type: Date
  },
  interactionCount: {
    type: Number,
    default: 0
  },
  autoReplySent: {
    type: Boolean,
    default: false
  },
  
  notes: [{
    text: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    type: Map,
    of: String
  }
}, {
  timestamps: true
});

// Indexes
leadSchema.index({ platform: 1, status: 1, qualification: 1 });
leadSchema.index({ platformId: 1, platform: 1 });
leadSchema.index({ email: 1 });
leadSchema.index({ phone: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ lastInteractionAt: -1 });
leadSchema.index({ interactionType: 1 });

module.exports = mongoose.model('Lead', leadSchema);