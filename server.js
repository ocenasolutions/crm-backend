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

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/leads', leadRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/instagram', instagramRoutes); // NEW
app.use('/api/templates', templateRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Start email monitoring
if (process.env.ENABLE_EMAIL_MONITORING === 'true') {
  startEmailMonitoring();
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 Email monitoring: ${process.env.ENABLE_EMAIL_MONITORING === 'true' ? 'ENABLED' : 'DISABLED'}`);
});