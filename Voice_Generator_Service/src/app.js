const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./db');
const voiceRoutes = require('./routes/voiceRoutes');
const authMiddleware = require('./middleware/auth');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads/voices', express.static(path.join(__dirname, 'uploads/voices')));
app.use('/samples', express.static(path.join(__dirname, 'public/samples'))); // For preview files

// Routes
app.use('/api/voice', authMiddleware, voiceRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false,
    message: 'Có lỗi xảy ra',
    error: err.message 
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Voice service running on port ${PORT}`);
});

module.exports = app;
