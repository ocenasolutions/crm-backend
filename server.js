const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const leadRoutes = require('./routes/leads');
const webhookRoutes = require('./routes/webhooks');
const { startEmailMonitoring } = require('./services/emailService');
const whatsappRoutes = require('./routes/whatsapp');
const instagramRoutes = require('./routes/instagram'); 
const templateRoutes = require('./routes/templates');
const testInstagramRoutes = require('./routes/test-instagram');

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Routes
app.use('/api/leads', leadRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/instagram', instagramRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/test', testInstagramRoutes); // NEW - Debug routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'CRM API Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      leads: '/api/leads',
      webhooks: '/api/webhooks',
      whatsapp: '/api/whatsapp',
      instagram: '/api/instagram',
      templates: '/api/templates',
      test: '/api/test'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('=== ERROR ===');
  console.error('Message:', err.message);
  console.error('Stack:', err.stack);
  console.error('=============');
  
  res.status(err.status || 500).json({
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 handler
app.use((req, res) => {
  console.log('404 - Route not found:', req.method, req.path);
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.path,
    availableRoutes: [
      '/health',
      '/api/leads',
      '/api/webhooks',
      '/api/whatsapp',
      '/api/instagram',
      '/api/templates',
      '/api/test'
    ]
  });
});

// Start email monitoring
if (process.env.ENABLE_EMAIL_MONITORING === 'true') {
  startEmailMonitoring();
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('=================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 Email monitoring: ${process.env.ENABLE_EMAIL_MONITORING === 'true' ? 'ENABLED' : 'DISABLED'}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('=================================');
  console.log('Available routes:');
  console.log('  GET  /health');
  console.log('  GET  /api/test/check-config');
  console.log('  GET  /api/test/ping');
  console.log('  GET  /api/test/list-leads');
  console.log('  POST /api/instagram/send/:id');
  console.log('  POST /api/instagram/test');
  console.log('  POST /api/instagram/broadcast');
  console.log('=================================');
});