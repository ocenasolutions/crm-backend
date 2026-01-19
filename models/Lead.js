const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
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
  source: {
    type: String,
    required: true,
    enum: ['whatsapp', 'email', 'instagram', 'facebook', 'website'],
    lowercase: true
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'converted', 'lost'],
    default: 'new'
  },
  message: {
    type: String
  },
  metadata: {
    type: Map,
    of: String
  },
  tags: [{
    type: String
  }],
  lastContactedAt: {
    type: Date
  },
  convertedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for better query performance
leadSchema.index({ source: 1, createdAt: -1 });
leadSchema.index({ status: 1 });
leadSchema.index({ email: 1 });
leadSchema.index({ phone: 1 });

module.exports = mongoose.model('Lead', leadSchema);