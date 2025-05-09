const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Voice = require('../models/Voice');
const cloudinary = require('cloudinary').v2;
const { GoogleAuth } = require('google-auth-library');
require('dotenv').config();

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const GOOGLE_TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const GOOGLE_VOICES_ENDPOINT = 'https://texttospeech.googleapis.com/v1/voices';

// Configure Google Auth
const auth = new GoogleAuth({
  credentials: {
    type: process.env.GOOGLE_TYPE,
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: process.env.GOOGLE_AUTH_URI,
    token_uri: process.env.GOOGLE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
    universe_domain: process.env.GOOGLE_UNIVERSE_DOMAIN
  },
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

// Predefined list of voices
const VOICE_LIST = [
  {
    voice_name: 'Standard-B',
    gender: 'MALE',
    voice_style: 'Standard'
  },
  {
    voice_name: 'Standard-C',
    gender: 'FEMALE',
    voice_style: 'Standard'
  },
  {
    voice_name: 'Chirp3-HD-Laomedeia',
    gender: 'FEMALE',
    voice_style: 'Expressive'
  },
  {
    voice_name: 'Chirp3-HD-Algenib',
    gender: 'MALE',
    voice_style: 'Expressive'
  },
  {
    voice_name: 'Chirp3-HD-Aoede',
    gender: 'FEMALE',
    voice_style: 'Professional'
  },
  {
    voice_name: 'Chirp3-HD-Enceladus',
    gender: 'MALE',
    voice_style: 'Professional'
  }
];

async function synthesize(payload) {
  console.log('=== Synthesize Voice Request ===');
  console.log('Request Data:', payload);
  
  try {
    const { job_id, voice_styles, segments } = payload;

    // Map voice dựa trên gender và style
    const selectedVoice = VOICE_LIST.find(voice => 
      voice.gender === voice_styles.gender && 
      voice.voice_style === voice_styles.style
    );

    if (!selectedVoice) {
      throw new Error(`Không tìm thấy voice phù hợp với gender: ${voice_styles.gender} và style: ${voice_styles.style}`);
    }

    const engine = 'google';
    const voice = `${voice_styles.language}-${selectedVoice.voice_name}`;
    const language = voice_styles.language;
    const speed = 1.0;
    const pitch = 0;

    const processedSegments = [];

    // Process each segment
    for (const segment of segments) {
      console.log(`Processing segment ${segment.index}...`);
      
      // Get Google TTS audio
      const client = await auth.getClient();
      const response = await axios.post(GOOGLE_TTS_ENDPOINT, {
        input: { text: segment.text },
        voice: { languageCode: language, name: voice },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: speed,
          pitch: pitch
        }
      }, {
        headers: {
          Authorization: `Bearer ${(await client.getAccessToken()).token}`
        }
      });

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

      console.log(`Segment ${segment.index} uploaded to Cloudinary successfully`);

      // Create new voice record in database
      const newVoice = new Voice({
        index: segment.index,
        type: 'Generate',
        url: result.secure_url,
        publicId: result.public_id,
        duration: result.duration,
        format: result.format,
        size: result.bytes,
        job_id: job_id,
        createdAt: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
        updatedAt: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
      });

      await newVoice.save();
      console.log(`Voice record for segment ${segment.index} created in database successfully`);

      // Add to processed segments array
      processedSegments.push({
        index: segment.index,
        script: segment.text,
        audio: result.secure_url,
        duration: result.duration
      });
    }

    return {
      job_id: job_id,
      segments: processedSegments
    };

  } catch (err) {
    console.error('Error in synthesize:', {
      message: err.message,
      response: err.response?.data,
      stack: err.stack
    });
    throw {
      success: false,
      message: 'Không thể tạo giọng nói',
      error: err.message || 'Lỗi khi tổng hợp giọng nói'
    };
  }
}

async function getPreview(gender, style, language) {
  console.log('=== Get Voice Preview Request ===');
  console.log('Request Parameters:', { gender, style, language });
  
  try {
    if (!gender || !style || !language) {
      throw new Error('Missing required parameters: gender, style, or language');
    }

    // Find voice based on gender and style
    const selectedVoice = VOICE_LIST.find(voice => 
      voice.gender === gender && 
      voice.voice_style === style
    );

    if (!selectedVoice) {
      throw new Error(`Không tìm thấy voice phù hợp với gender: ${gender} và style: ${style}`);
    }

    const voice = `${language}-${selectedVoice.voice_name}`;

    // Generate a short preview text
    const previewText = "This is a preview of my voice. How do I sound?";

    // Call Google TTS API to generate preview audio
    const client = await auth.getClient();
    const response = await axios.post(GOOGLE_TTS_ENDPOINT, {
      input: { text: previewText },
      voice: { languageCode: language, name: voice },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0
      }
    }, {
      headers: {
        Authorization: `Bearer ${(await client.getAccessToken()).token}`
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

    res.status
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

    // Format voices to match required response structure
    const formattedVoices = VOICE_LIST.map(v => ({
      name: `${language}-${v.voice_name}`,
      language: language,
      gender: v.gender,
      styles: [v.voice_style]
    }));

    return {
      engine: engine,
      voices: formattedVoices
    };
  } catch (err) {
    console.error('Error in getVoices:', {
      message: err.message,
      stack: err.stack
    });
    throw {
      success: false,
      message: 'Failed to get voices',
      error: err.message
    };
  }
}

async function uploadVoice(index, file, job_id) {
  console.log('=== Upload Voice Request ===');
  console.log('Request Data:', { index, filename: file.originalname, job_id });
  
  try {
    if (!index || !file || !job_id) {
      throw new Error('Missing required parameters: index, file, or job_id');
    }

    // Validate file type
    if (!file.mimetype.includes('audio/')) {
      throw new Error('Only audio files are allowed');
    }

    // Upload file to Cloudinary
    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream({
        resource_type: 'video',
        folder: `custom_audio/${job_id}`,
        format: 'mp3',
        public_id: `voice_custom_${index}`
      }, (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(new Error('Failed to upload file to Cloudinary'));
        } else {
          resolve(result);
        }
      });

      uploadStream.end(file.buffer);
    });

    const result = await uploadPromise;
    console.log('File uploaded to Cloudinary successfully:', result);

    // Create new voice record in database
    const newVoice = new Voice({
      index: index,
      type: 'Custom',
      url: result.secure_url,
      publicId: result.public_id,
      duration: result.duration,
      format: result.format,
      size: result.bytes,
      job_id: job_id
    });

    await newVoice.save();
    console.log('Voice record created in database successfully');
    
    return {
      job_id: job_id,
      index: index,
      audio: result.secure_url
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
