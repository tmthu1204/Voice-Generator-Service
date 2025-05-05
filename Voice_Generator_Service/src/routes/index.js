const express = require('express');
const router = express.Router();
const voiceRoutes = require('./voice');

// Áp dụng middleware auth cho tất cả các route
router.use('/voices', voiceRoutes);

module.exports = router; 