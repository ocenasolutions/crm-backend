const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_db', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// Import Routes
const leadRoutes = require('./routes/leadRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

// Routes
app.use('/api/leads', leadRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/webhooks', webhookRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'CRM Backend is running' });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!', 
    message: err.message 
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});