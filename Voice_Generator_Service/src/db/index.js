const mongoose = require('mongoose');
require('dotenv').config();

const connectVoiceDB = async () => {
  try {
    const mongoURI = process.env.VOICE_MONGODB_URI;
    if (!mongoURI) {
      throw new Error('VOICE_MONGODB_URI is not defined in environment variables');
    }

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoURI);
      console.log('Đã kết nối thành công với Voice MongoDB');
    }
    
    return mongoose.connection;
  } catch (error) {
    console.error('Voice MongoDB Connection Error:', error);
    process.exit(1);
  }
};

module.exports = connectVoiceDB;
