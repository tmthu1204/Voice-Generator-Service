const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Voice = require('../models/Voice');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const GOOGLE_TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const GOOGLE_VOICES_ENDPOINT = 'https://texttospeech.googleapis.com/v1/voices';
const API_KEY = process.env.GOOGLE_TTS_API_KEY;

async function synthesize({ scriptId, engine = 'google', voice, language, style, speed = 1.0, pitch = 0, text, userId }) {
  console.log('=== Synthesize Voice Request ===');
  console.log('Request Data:', { scriptId, engine, voice, language, style, speed, pitch, text, userId });
  
  try {
    console.log('Sending request to Google TTS API...');
    const response = await axios.post(`${GOOGLE_TTS_ENDPOINT}?key=${API_KEY}`, {
      input: { text },
      voice: { languageCode: language, name: voice },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: speed,
        pitch: pitch
      }
    });

    console.log('Google TTS API Response Status:', response.status);
    const audioContent = response.data.audioContent;

    // Upload audio content to Cloudinary
    const result = await cloudinary.uploader.upload(
      `data:audio/mp3;base64,${audioContent}`,
      {
        resource_type: 'video',
        folder: 'voices',
        format: 'mp3'
      }
    );

    console.log('File uploaded to Cloudinary successfully');

    // Tạo record mới trong database
    const newVoice = new Voice({
      name: `voice_${scriptId}_${Date.now()}`,
      description: `Voice for script ${scriptId}`,
      url: result.secure_url,
      publicId: result.public_id,
      duration: result.duration,
      format: result.format,
      size: result.bytes,
      createdBy: userId
    });

    await newVoice.save();
    console.log('Voice record created in database successfully');
    
    return {
      success: true,
      data: newVoice
    };
  } catch (err) {
    console.error('Error in synthesize:', {
      message: err.message,
      response: err.response?.data,
      stack: err.stack
    });
    throw {
      success: false,
      message: 'Lỗi khi tổng hợp giọng nói',
      error: err.message
    };
  }
}

async function getPreview(engine, voice, language) {
  console.log('=== Get Voice Preview Request ===');
  console.log('Request Parameters:', { engine, voice, language });
  
  try {
    if (!engine || !voice || !language) {
      throw new Error('Missing required parameters: engine, voice, or language');
    }

    if (engine !== 'google') {
      throw new Error('Only Google TTS engine is supported for preview');
    }

    // Generate a short preview text
    const previewText = "This is a preview of my voice. How do I sound?";

    // Call Google TTS API to generate preview audio
    const response = await axios.post(`${GOOGLE_TTS_ENDPOINT}?key=${API_KEY}`, {
      input: { text: previewText },
      voice: { languageCode: language, name: voice },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0
      }
    });

    const audioContent = response.data.audioContent;

    // Upload preview audio to Cloudinary
    const result = await cloudinary.uploader.upload(
      `data:audio/mp3;base64,${audioContent}`,
      {
        resource_type: 'video',
        folder: 'previews',
        format: 'mp3'
      }
    );

    return {
      success: true,
      sampleUrl: result.secure_url
    };
  } catch (err) {
    console.error('Error in getPreview:', {
      message: err.message,
      response: err.response?.data,
      stack: err.stack
    });
    throw {
      success: false,
      message: 'Failed to generate voice preview',
      error: err.message
    };
  }
}

async function getVoices(engine, language = null) {
  console.log('=== Get Available Voices Request ===');
  console.log('Request Parameters:', { engine, language });
  
  try {
    if (!engine) {
      throw new Error('Engine parameter is required');
    }

    if (engine !== 'google') {
      throw new Error('Only Google TTS engine is supported');
    }

    // Fetch voices from Google TTS API
    const response = await axios.get(`${GOOGLE_VOICES_ENDPOINT}?key=${API_KEY}`);
    let voices = response.data.voices;

    // Filter by language if specified
    if (language) {
      voices = voices.filter(v => v.languageCodes.includes(language));
    }

    // Format voices to match required response structure
    const formattedVoices = voices.map(v => ({
      name: v.name,
      language: v.languageCodes[0],
      gender: v.ssmlGender,
      styles: [] // Google TTS doesn't support styles
    }));

    return {
      engine: engine,
      voices: formattedVoices
    };
  } catch (err) {
    console.error('Error in getVoices:', {
      message: err.message,
      response: err.response?.data,
      stack: err.stack
    });
    throw {
      success: false,
      message: 'Failed to get voices',
      error: err.message
    };
  }
}

async function uploadVoice(scriptId, file, userId) {
  console.log('=== Upload Voice Request ===');
  console.log('Request Data:', { scriptId, filename: file.originalname, userId });
  
  try {
    if (!scriptId || !file || !userId) {
      throw new Error('Missing required parameters: scriptId, file, or userId');
    }

    // Validate file type
    if (!file.mimetype.includes('audio/mpeg')) {
      throw new Error('Only MP3 files are allowed');
    }

    // Upload file to Cloudinary
    const result = await cloudinary.uploader.upload(file.buffer, {
      resource_type: 'video',
      folder: `custom_audio/${userId}`,
      format: 'mp3',
      public_id: `voice_custom_${scriptId}`
    });

    console.log('File uploaded to Cloudinary successfully');

    // Create new voice record in database
    const newVoice = new Voice({
      name: file.originalname,
      description: `Custom voice for script ${scriptId}`,
      url: result.secure_url,
      publicId: result.public_id,
      duration: result.duration,
      format: result.format,
      size: result.bytes,
      createdBy: userId,
      scriptId: scriptId,
      engine: 'user-upload'
    });

    await newVoice.save();
    console.log('Voice record created in database successfully');
    
    return {
      message: 'Giọng nói người thật đã được tải lên thay thế.',
      audioUrl: result.secure_url
    };
  } catch (err) {
    console.error('Error in uploadVoice:', {
      message: err.message,
      stack: err.stack
    });
    throw {
      success: false,
      message: 'Lỗi khi tải lên giọng nói người thật',
      error: err.message
    };
  }
}

async function deleteVoice(voiceId) {
  console.log('=== Delete Voice Request ===');
  console.log('Voice ID:', voiceId);
  
  try {
    console.log('Finding and deleting voice from database...');
    const voice = await Voice.findByIdAndDelete(voiceId);
    if (!voice) {
      console.error('Voice not found with ID:', voiceId);
      throw new Error('Voice not found');
    }

    if (voice.engine === 'user-upload') {
      const filePath = path.join(__dirname, '../uploads/voices', path.basename(voice.url));
      console.log('Deleting voice file:', filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Voice file deleted successfully');
      }
    }

    console.log('Voice deletion completed successfully');
    return { message: 'Voice deleted successfully' };
  } catch (err) {
    console.error('Error in deleteVoice:', err);
    throw err;
  }
}

module.exports = {
  synthesize,
  getPreview,
  getVoices,
  uploadVoice,
  deleteVoice
};
