const mongoose = require('mongoose');

const voiceSchema = new mongoose.Schema({
  index: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['Generate', 'Custom']
  },
  url: {
    type: String,
    required: true
  },
  publicId: {
    type: String,
    required: true
  },
  duration: {
    type: Number
  },
  format: {
    type: String
  },
  size: {
    type: Number
  },
  job_id: {
    type: String,
    required: true
  },
  createdAt: {
    type: String,
    default: () => new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  },
  updatedAt: {
    type: String,
    default: () => new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  }
});

module.exports = mongoose.model('Voice', voiceSchema);
