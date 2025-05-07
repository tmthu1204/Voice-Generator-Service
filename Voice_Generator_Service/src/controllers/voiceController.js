const connectVoiceDB = require('../db');
const Voice = require('../models/Voice');

// Khởi tạo kết nối & model
let VoiceModel;

(async () => {
  const conn = await connectVoiceDB();
  VoiceModel = Voice(conn);
})().catch(err => {
  console.error('Error initializing Voice model:', err);
});

// Middleware/Service các xử lý logic tổng hợp, preview, upload... (giả sử đã có)
const voiceService = require('../services/voiceService'); // Giữ nguyên tên, bạn có thể chỉnh trong service

exports.synthesizeVoice = async (req, res) => {
  try {
    // Lấy userId từ req.user (được set bởi middleware auth)
    console.log(req.user);
    const userId = req.user._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa xác thực người dùng'
      });
    }

    const { 
      job_id,
      voice_styles,
      edited_images,
      videoSettings,
      backgroundMusic 
    } = req.body;

    // Validate required fields
    if (!job_id || !voice_styles || !edited_images || !videoSettings) {
      return res.status(400).json({ 
        success: false,
        message: 'Thiếu các trường bắt buộc: job_id, voice_styles, edited_images, videoSettings' 
      });
    }

    // Validate voice_styles array
    if (!Array.isArray(voice_styles) || voice_styles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'voice_styles phải là một mảng không rỗng'
      });
    }

    // Validate each voice style object
    for (const style of voice_styles) {
      if (!style.index || !style.engine || !style.voice || !style.language || !style.text) {
        return res.status(400).json({
          success: false,
          message: 'Mỗi voice style phải có đầy đủ các trường: index, engine, voice, language, text'
        });
      }
    }

    // Validate edited_images array
    if (!Array.isArray(edited_images) || edited_images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'edited_images phải là một mảng không rỗng'
      });
    }

    // Validate each edited image object
    for (const image of edited_images) {
      if (!image.index || !image.image_url) {
        return res.status(400).json({
          success: false,
          message: 'Mỗi edited image phải có đầy đủ các trường: index, image_url'
        });
      }
    }

    // Validate videoSettings object
    const requiredVideoSettings = ['maxAudioSpeed', 'resolution', 'frameRate', 'bitrate', 'audioMismatchStrategy'];
    for (const setting of requiredVideoSettings) {
      if (!videoSettings[setting]) {
        return res.status(400).json({
          success: false,
          message: `videoSettings thiếu trường bắt buộc: ${setting}`
        });
      }
    }

    const result = await voiceService.synthesize({
      job_id,
      voice_styles,
      edited_images,
      videoSettings,
      backgroundMusic
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Lỗi khi tổng hợp giọng nói:', err);
    res.status(500).json({ 
      success: false,
      message: 'Không thể tạo giọng nói',
      error: err.message 
    });
  }
};

exports.getVoicePreview = async (req, res) => {
  try {
    const { engine, voice, language } = req.query;

    if (!engine || !voice || !language) {
      return res.status(400).json({ error: 'Thiếu các tham số bắt buộc' });
    }

    const sample = await voiceService.getPreview(engine, voice, language);
    res.status(200).json(sample);
  } catch (err) {
    console.error('Lỗi khi lấy preview giọng nói:', err);
    res.status(500).json({ error: 'Không thể lấy bản nghe thử' });
  }
};

exports.getVoicesList = async (engine, language) => {
  try {
    const voices = await voiceService.getVoices(engine, language);
    return {
      success: true,
      data: voices
    };
  } catch (err) {
    console.error('Lỗi khi lấy danh sách giọng nói:', err);
    throw {
      success: false,
      message: 'Không thể lấy danh sách giọng nói',
      error: err.message
    };
  }
};

exports.uploadUserVoice = async (req, res) => {
  try {
    const userId = req.user._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa xác thực người dùng'
      });
    }

    const { index, job_id } = req.body;
    const file = req.file;

    if (!index || !job_id || !file) {
      return res.status(400).json({ 
        success: false,
        message: 'Thiếu index, job_id hoặc file giọng nói' 
      });
    }

    const result = await voiceService.uploadVoice(index, file, job_id);
    res.status(200).json(result);
  } catch (err) {
    console.error('Lỗi khi upload giọng nói người dùng:', err);
    res.status(500).json({ 
      success: false,
      message: 'Có lỗi xảy ra',
      error: err.message 
    });
  }
};

exports.deleteVoice = async (req, res) => {
  try {
    const { voiceId } = req.params;

    if (!voiceId) {
      return res.status(400).json({ error: 'Thiếu voiceId' });
    }

    const result = await voiceService.deleteVoice({
      VoiceModel: VoiceModel,
      voiceId
    });

    res.status(200).json(result);
  } catch (err) {
    console.error('Lỗi khi xoá giọng nói:', err);
    res.status(500).json({ error: 'Không thể xoá giọng nói' });
  }
};
