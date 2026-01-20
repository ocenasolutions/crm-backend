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
    type: String, // Unique identifier from the platform (sender ID, etc.)
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

// Index for faster queries
leadSchema.index({ platform: 1, status: 1, qualification: 1 });
leadSchema.index({ email: 1 });
leadSchema.index({ phone: 1 });
leadSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Lead', leadSchema);