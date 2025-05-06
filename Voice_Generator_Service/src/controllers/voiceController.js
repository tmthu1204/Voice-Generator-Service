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

    const { scriptId, engine, voice, language, style, speed, pitch, text } = req.body;

    if (!scriptId || !engine || !voice || !language || !text) {
      return res.status(400).json({ 
        success: false,
        message: 'Thiếu các trường bắt buộc' 
      });
    }

    const result = await voiceService.synthesize({
      scriptId,
      engine,
      voice,
      language,
      style,
      speed,
      pitch,
      text,
      userId
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

exports.getVoicesList = async (req, res) => {
  try {
    const { engine, language } = req.query;

    const voices = await voiceService.getVoices(engine, language);
    res.status(200).json(voices);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách giọng nói:', err);
    res.status(500).json({ error: 'Không thể lấy danh sách giọng nói' });
  }
};

exports.uploadUserVoice = async (req, res) => {
  try {
    const { userId } = req;
    const { scriptId } = req.body;
    const file = req.file;

    if (!scriptId || !file) {
      return res.status(400).json({ error: 'Thiếu scriptId hoặc file giọng nói' });
    }

    const result = await voiceService.uploadVoice({
      VoiceModel: VoiceModel,
      userId,
      scriptId,
      file
    });

    res.status(200).json(result);
  } catch (err) {
    console.error('Lỗi khi upload giọng nói người dùng:', err);
    res.status(500).json({ error: 'Không thể upload giọng nói' });
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
